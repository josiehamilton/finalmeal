import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage, getDishesInView } from '@finalmeal/api';
import type { DiscoverDish } from '@finalmeal/api';
import type { DiscoverFilters } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import type { MapRegion } from '../map/bridge';
import { DishResultRow } from './DishResultRow';
import { PrimaryButton } from './PrimaryButton';

/** How many dishes the list view asks for (the database caps a read at 50). */
const LIST_LIMIT = 50;

interface DiscoverListViewProps {
  region: MapRegion | null;
  filters: DiscoverFilters;
  /** `12 picks near Vancouver`. */
  title: string;
  /** The height of the top bar the list sits under. */
  topInset: number;
  onMapView: () => void;
  onOpenPick: (pickId: string) => void;
  /** A dish with no pick the viewer may open: show its place on the map instead. */
  onSelectPlace: (placeId: string) => void;
}

/**
 * The list behind `List view`: the same dishes as the map, as rows. It is the accessible way to
 * reach every pick (the map's markers are not), and it keeps working when the map does not load.
 */
export function DiscoverListView({
  region,
  filters,
  title,
  topInset,
  onMapView,
  onOpenPick,
  onSelectPlace,
}: DiscoverListViewProps) {
  const [dishes, setDishes] = useState<DiscoverDish[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);

  const load = useCallback(() => {
    if (!region) return;
    const id = ++request.current;
    setError(null);
    getDishesInView(getSupabase(), region.bounds, filters, region.center, { limit: LIST_LIMIT }).then(
      (rows) => {
        if (mounted.current && id === request.current) setDishes(rows);
      },
      (e: unknown) => {
        if (mounted.current && id === request.current) setError(friendlyMessage(e));
      },
    );
  }, [region, filters]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  return (
    <View style={[styles.screen, { paddingTop: topInset }]} testID="discover-list">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Map view" onPress={onMapView} hitSlop={8}>
          <Text style={styles.link}>Map view</Text>
        </Pressable>
      </View>
      {error ? (
        <View style={styles.message}>
          <Text style={styles.body} accessibilityRole="alert">
            {error}
          </Text>
          <View style={styles.retry}>
            <PrimaryButton variant="ghost" size="compact" label="Try again" onPress={load} />
          </View>
        </View>
      ) : dishes === null ? (
        <ActivityIndicator color={colors.dim} style={styles.spinner} />
      ) : (
        <ScrollView contentContainerStyle={styles.rows}>
          {dishes.length === 0 ? <Text style={styles.empty}>No picks here yet.</Text> : null}
          {dishes.map((dish) => (
            <DishResultRow
              key={`${dish.dishId}:${dish.place.id}`}
              dish={dish}
              onPress={(d) => (d.pickId ? onOpenPick(d.pickId) : onSelectPlace(d.place.id))}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.night },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { flexShrink: 1, fontFamily: fontFamily.uiBold, fontSize: 17, color: colors.bone },
  link: { fontFamily: fontFamily.uiBold, fontSize: 13, color: colors.emberGlow },
  rows: { paddingHorizontal: 20, paddingBottom: 24 },
  message: { paddingHorizontal: 20, paddingTop: 20, gap: 12, alignItems: 'flex-start' },
  body: { fontFamily: fontFamily.ui, fontSize: 14, color: colors.smoke },
  empty: { paddingTop: 20, fontFamily: fontFamily.ui, fontSize: 14, color: colors.smoke },
  retry: { minWidth: 140 },
  spinner: { paddingTop: 32 },
});
