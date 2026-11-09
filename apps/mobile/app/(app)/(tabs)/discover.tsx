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
  const { profile } = useSession();
  const homeId = profile?.homeCity?.id ?? null;
  const [start, setStart] = useState<{ id: string | null; point: LatLng | null } | null>(null);

  useEffect(() => {
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
  }, [homeId]);

  if (!start || start.id !== homeId) return <View style={styles.screen} />;
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
  const [focusId, setFocusId] = useState<string | null>(null);

  const pins = useMemo(() => pinsForDiscover(d.places), [d.places]);
  const insets = useMemo(() => ({ top: topHeight, bottom: sheetHeight }), [topHeight, sheetHeight]);

  // Search sends a place to focus: fly there, then select it once the map has loaded its pin.
  const { placeId, lat, lng } = params;
  const setParams = router.setParams;
  useEffect(() => {
    if (!placeId) return;
    const la = parseFloat(lat ?? '');
    const ln = parseFloat(lng ?? '');
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      mapRef.current?.flyTo({ lat: la, lng: ln, zoom: FOCUS_ZOOM });
    }
    setFocusId(placeId);
    setParams({ placeId: undefined, lat: undefined, lng: undefined });
  }, [placeId, lat, lng, setParams]);

  const { select } = d;
  useEffect(() => {
    if (focusId && d.places.some((p) => p.id === focusId)) {
      select(focusId);
      setFocusId(null);
    }
  }, [focusId, d.places, select]);

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
    setFocusId(null);
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
            setFocusId(null);
            d.select(id);
          }}
          onMapPress={() => {
            setFocusId(null);
            d.select(null);
          }}
        />
      </View>
      <MapLegend top={topHeight + 12} />
      {showSelected ? (
        <SelectedPlaceSheet dishes={d.selected ?? []} onOpenPick={openPick} onLayout={sheetLayout} />
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
