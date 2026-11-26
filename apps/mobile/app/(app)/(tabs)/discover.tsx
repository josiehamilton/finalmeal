import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { getCity } from '@finalmeal/api';
import type { LatLng } from '@finalmeal/api';
import { DEFAULT_DISCOVER_FILTERS, picksNearLabel, sheetFilterCount } from '@finalmeal/core';
import type { DiscoverFilters, DiscoverTier } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { DiscoverListView } from '../../../src/components/DiscoverListView';
import { DiscoverSheet } from '../../../src/components/DiscoverSheet';
import type { DiscoverSheetMode } from '../../../src/components/DiscoverSheet';
import { DiscoverTopBar } from '../../../src/components/DiscoverTopBar';
import { FiltersSheet } from '../../../src/components/FiltersSheet';
import { MapLegend } from '../../../src/components/MapLegend';
import { SelectedPlaceSheet } from '../../../src/components/SelectedPlaceSheet';
import { getSupabase } from '../../../src/lib/supabase';
import { FOCUS_ZOOM, HOME_ZOOM, WORLD_CAMERA } from '../../../src/map/camera';
import { pinsForDiscover } from '../../../src/map/pins';
import { PicksMap } from '../../../src/map/PicksMap';
import type { PicksMapHandle } from '../../../src/map/PicksMap';
import { useSession } from '../../../src/providers/SessionProvider';
import { hasActiveFilters, useDiscover } from '../../../src/state/discover';

/** Until the bars have been measured, a guess close enough to keep the first fit in the open part. */
const TOP_BAR_GUESS = 160;
const SHEET_GUESS = 200;
/** The map counts as "still the world view" at or below this zoom. */
const WORLD_VIEW_MAX_ZOOM = 3;

/**
 * The Discover tab. The map starts at the home city's point, or at the world view without one
 * (never at the phone's position), so the screen waits for that point before it mounts the map.
 * A different home city mounts it afresh, at the new city.
 */
export default function Discover() {
  const { profile, loading } = useSession();
  const homeId = profile?.homeCity?.id ?? null;
  const [start, setStart] = useState<{ id: string | null; point: LatLng | null } | null>(null);

  useEffect(() => {
    // Until the profile has loaded, nobody knows whether there is a home city.
    if (loading) return;
    if (homeId === null) {
      setStart({ id: null, point: null });
      return;
    }
    let cancelled = false;
    getCity(getSupabase(), homeId).then(
      (city) => {
        if (!cancelled) setStart({ id: homeId, point: city ? { lat: city.lat, lng: city.lng } : null });
      },
      // Without the point the map opens on the world view; the sheet still works.
      () => {
        if (!cancelled) setStart({ id: homeId, point: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [homeId, loading]);

  if (loading || !start || start.id !== homeId) return <View style={styles.screen} />;
  return <DiscoverScreen key={homeId ?? 'none'} home={start.point} hasHomeCity={homeId !== null} />;
}

/** Five decimals is about a metre: enough for a search point, short enough for a link. */
function coordinate(n: number): number {
  return Number(n.toFixed(5));
}

interface DiscoverScreenProps {
  home: LatLng | null;
  hasHomeCity: boolean;
}

function DiscoverScreen({ home, hasHomeCity }: DiscoverScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ placeId?: string; lat?: string; lng?: string }>();
  const d = useDiscover(home);
  const mapRef = useRef<PicksMapHandle>(null);
  const initialCamera = useRef(
    home ? { lat: home.lat, lng: home.lng, zoom: HOME_ZOOM } : WORLD_CAMERA,
  ).current;

  const [topHeight, setTopHeight] = useState(TOP_BAR_GUESS);
  const [sheetHeight, setSheetHeight] = useState(SHEET_GUESS);
  const [listOpen, setListOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** A place to select once its pin has loaded (Search sent us here). */
  const [focus, setFocus] = useState<{ id: string; from: LatLng | null } | null>(null);
  // Where the map looked before Search sent us to a place; distances are measured from there.
  const centreRef = useRef<LatLng | null>(null);
  centreRef.current = d.region?.center ?? null;

  const pins = useMemo(() => pinsForDiscover(d.places), [d.places]);
  const insets = useMemo(() => ({ top: topHeight, bottom: sheetHeight }), [topHeight, sheetHeight]);

  // Search sends a place to focus: fly there, then select it once the map has loaded its pin.
  const { placeId, lat, lng } = params;
  const setParams = router.setParams;
  useEffect(() => {
    if (!placeId && !(lat && lng)) return;
    const la = parseFloat(lat ?? '');
    const ln = parseFloat(lng ?? '');
    const at = Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null;
    // No place id: a spot with no pin. Move to its city and select nothing.
    if (at) mapRef.current?.flyTo({ ...at, zoom: placeId ? FOCUS_ZOOM : HOME_ZOOM });
    if (placeId) setFocus({ id: placeId, from: centreRef.current ?? home });
    setParams({ placeId: undefined, lat: undefined, lng: undefined });
  }, [placeId, lat, lng, setParams, home]);

  const { select } = d;
  useEffect(() => {
    if (focus && d.places.some((p) => p.id === focus.id)) {
      // Distances come from where the map was, not from the place it flies to (that would read 0 m).
      select(focus.id, focus.from ?? undefined);
      setFocus(null);
    }
  }, [focus, d.places, select]);

  const total = d.places.reduce((sum, p) => sum + p.pickCount, 0);
  const title = picksNearLabel(total, d.cityName);
  const worldView = !hasHomeCity && (d.region === null || d.region.zoom <= WORLD_VIEW_MAX_ZOOM);
  const loading = d.status !== 'ready' && d.status !== 'error' && d.places.length === 0 && d.dishes.length === 0;
  let mode: DiscoverSheetMode = 'picks';
  if (d.status === 'error') mode = 'error';
  else if (worldView) mode = 'noHome';
  else if (d.status === 'ready' && d.places.length === 0 && d.dishes.length === 0) {
    mode = hasActiveFilters(d.filters) ? 'emptyFiltered' : 'empty';
  }

  function changeFilters(next: DiscoverFilters) {
    setFocus(null);
    d.setFilters(next);
  }

  function chooseTier(tier: DiscoverTier) {
    if (tier !== d.filters.tier) changeFilters({ ...d.filters, tier });
  }

  function openSearch() {
    const c = d.region?.center ?? home ?? WORLD_CAMERA;
    router.push(`/search?from=discover&lat=${coordinate(c.lat)}&lng=${coordinate(c.lng)}`);
  }

  const openPick = (pickId: string) => router.push(`/pick/${pickId}`);
  // The map is padded by the in-view sheet only. The selected spot's sheet is taller, and following it
  // would shift the map under the finger that just tapped a pin.
  const sheetLayout = (event: LayoutChangeEvent) => setSheetHeight(event.nativeEvent.layout.height);
  const showSelected = d.selectedId !== null && d.selected !== null && d.selected.length > 0;

  return (
    <View style={styles.screen}>
      <View style={StyleSheet.absoluteFill}>
        <PicksMap
          ref={mapRef}
          testID="discover-map"
          initialCamera={initialCamera}
          pins={pins}
          selectedId={d.selectedId}
          insets={insets}
          onRegionChange={d.onRegionChange}
          onPinPress={(id) => {
            setFocus(null);
            d.select(id);
          }}
          onMapPress={() => {
            setFocus(null);
            d.select(null);
          }}
        />
      </View>
      <MapLegend top={topHeight + 12} />
      {showSelected ? (
        <SelectedPlaceSheet
          dishes={d.selected ?? []}
          onOpenPick={openPick}
          onClose={() => d.select(null)}
          onLayout={() => {}}
        />
      ) : (
        <DiscoverSheet
          mode={mode}
          title={title}
          dishes={d.dishes}
          truncated={d.truncated}
          loading={loading}
          error={d.error}
          onOpenList={() => setListOpen(true)}
          onOpenPick={openPick}
          onResetFilters={() => changeFilters(DEFAULT_DISCOVER_FILTERS)}
          onChooseHomeCity={() => router.push('/settings/home-city')}
          onRetry={d.retry}
          onLayout={sheetLayout}
        />
      )}
      {listOpen ? (
        <DiscoverListView
          region={d.region}
          filters={d.filters}
          title={title}
          topInset={topHeight}
          onMapView={() => setListOpen(false)}
          onOpenPick={openPick}
          onSelectPlace={(placeId) => {
            setListOpen(false);
            d.select(placeId);
          }}
        />
      ) : null}
      <DiscoverTopBar
        tier={d.filters.tier}
        followingOnly={d.filters.followingOnly}
        sheetFilterCount={sheetFilterCount(d.filters)}
        onTier={chooseTier}
        onToggleFollowing={() => changeFilters({ ...d.filters, followingOnly: !d.filters.followingOnly })}
        onSearch={openSearch}
        onFilters={() => setFiltersOpen(true)}
        onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}
      />
      <FiltersSheet
        visible={filtersOpen}
        filters={d.filters}
        region={d.region}
        onApply={(next) => {
          setFiltersOpen(false);
          if (JSON.stringify(next) !== JSON.stringify(d.filters)) changeFilters(next);
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
});
