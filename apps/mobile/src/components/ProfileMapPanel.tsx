import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Pick } from '@finalmeal/api';
import { citiesLine, mapSummary } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { HOME_ZOOM, WORLD_CAMERA } from '../map/camera';
import type { MapPin } from '../map/bridge';
import { pinsForPicks } from '../map/pins';
import { PicksMap } from '../map/PicksMap';
import { PlacePicksCard } from './PlacePicksCard';
import type { PlacePicksRow } from './PlacePicksCard';

/** Keeps pins and the fit out from under the footer. */
const MAP_INSETS = { top: 24, bottom: 84 };

interface PinMapCardProps {
  pins: MapPin[];
  selectedId: string | null;
  onPinPress: (id: string) => void;
  onMapPress: () => void;
  /** Drawn over the bottom of the map: the footer, or the card of a tapped pin. */
  overlay: ReactNode;
  height?: number;
  /** Changes when the shown set changes (a filter), so the map frames its pins again. */
  fitKey: string;
  /** Told true while a finger is on the map: the page behind must not scroll then. */
  onScrollLock?: (locked: boolean) => void;
  testID?: string;
}

/** The map card of the ProfileMap and Saved boards: a rounded, bordered map that only shows pins. */
export function PinMapCard({
  pins,
  selectedId,
  onPinPress,
  onMapPress,
  overlay,
  height,
  fitKey,
  onScrollLock,
  testID,
}: PinMapCardProps) {
  // The map opens at the first pin's place, or the world; the first set of pins then frames itself.
  const initialCamera = useRef(
    pins[0] ? { lat: pins[0].lat, lng: pins[0].lng, zoom: HOME_ZOOM } : WORLD_CAMERA,
  ).current;
  return (
    <View style={[styles.card, height === undefined ? styles.fill : { height }]}>
      <PicksMap
        testID={testID}
        initialCamera={initialCamera}
        pins={pins}
        selectedId={selectedId}
        insets={MAP_INSETS}
        fitOnFirstPins
        fitKey={fitKey}
        embedded
        onTouchLock={onScrollLock}
        onPinPress={onPinPress}
        onMapPress={onMapPress}
      />
      {overlay}
    </View>
  );
}

interface ProfileMapPanelProps {
  picks: Pick[];
  chipLabel: string | null;
  emptyText: string;
  onOpenPick: (id: string) => void;
  /** The screen's ScrollView stops scrolling while this is true (a finger is on the map). */
  onScrollLock?: (locked: boolean) => void;
}

/** The Map tab of a profile (the ProfileMap board): a summary, the map, and a footer or a pin's card. */
export function ProfileMapPanel({ picks, chipLabel, emptyText, onOpenPick, onScrollLock }: ProfileMapPanelProps) {
  const [tapped, setTapped] = useState<string | null>(null);
  const pins = useMemo(() => pinsForPicks(picks), [picks]);
  // A filter or a refresh can take the tapped place away.
  const selectedId = tapped && pins.some((p) => p.id === tapped) ? tapped : null;

  if (pins.length === 0) {
    // Picks without a point (a spot waiting for its address) are not "no picks".
    return (
      <Text style={styles.empty}>
        {picks.length > 0 ? 'None of these spots are on the map yet.' : emptyText}
      </Text>
    );
  }

  const here = selectedId ? picks.filter((p) => p.place.id === selectedId) : [];
  // Final Meals first; the sort is stable, so each tier keeps the order it came in.
  const rows: PlacePicksRow[] = [...here]
    .sort((a, b) => Number(b.tier === 'final') - Number(a.tier === 'final'))
    .map((p) => ({
      key: p.id,
      dishName: p.dish.name,
      suffix: p.tier === 'final' ? ' · Final Meal' : ' · Honorable',
      onPress: () => onOpenPick(p.id),
    }));

  return (
    <View style={styles.panel}>
      {/* "Share these" joins this row in Phase 6, when sharing lists exists. */}
      <Text style={styles.summary}>{mapSummary(picks, chipLabel)}</Text>
      <PinMapCard
        testID="profile-map"
        pins={pins}
        selectedId={selectedId}
        height={MAP_HEIGHT}
        fitKey={chipLabel ?? 'all'}
        onScrollLock={onScrollLock}
        onPinPress={setTapped}
        onMapPress={() => setTapped(null)}
        overlay={
          selectedId && here[0] ? (
            <PlacePicksCard
              placeName={here[0].place.name}
              rows={rows}
              onClose={() => setTapped(null)}
            />
          ) : (
            <View style={styles.footer} testID="profile-map-footer">
              <Text style={styles.footerText} numberOfLines={1}>
                <Text style={styles.footerStrong}>{chipLabel ?? 'All picks'}</Text>
                <Text style={styles.footerMuted}>{` · ${citiesLine(picks)}`}</Text>
              </Text>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: colors.ember }]} />
                  <Text style={styles.footerMuted}>Final</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: colors.honorable }]} />
                  <Text style={styles.footerMuted}>Honorable</Text>
                </View>
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

const MAP_HEIGHT = 440;

const styles = StyleSheet.create({
  // The screens that show this pad their panel by 20; the summary and card undo that to set their own.
  panel: { marginHorizontal: -20, gap: 4 },
  summary: {
    paddingHorizontal: 20,
    fontFamily: fontFamily.ui,
    fontSize: 13,
    color: colors.smoke,
  },
  card: {
    marginVertical: 6,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  fill: { flex: 1 },
  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
  },
  footerText: { flexShrink: 1, fontSize: 13 },
  footerStrong: { fontFamily: fontFamily.uiBold, fontSize: 13, color: colors.bone },
  footerMuted: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: {
    paddingTop: 24,
    fontFamily: fontFamily.ui,
    fontSize: 15,
    color: colors.smoke,
    textAlign: 'center',
  },
});
