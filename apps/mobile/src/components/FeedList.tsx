import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage, getFollowingFeed, getNearbyFeed } from '@finalmeal/api';
import type { FeedCursor, FeedItem } from '@finalmeal/api';
import { appendUniqueByKey } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { cityName } from '../lib/city-name';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { useSession } from '../providers/SessionProvider';
import { FeedCard } from './FeedCard';
import { FeedEmpty } from './FeedEmpty';
import type { FeedEmptyVariant } from './FeedEmpty';
import { PhotoNotice } from './PhotoNotice';
import { PrimaryButton } from './PrimaryButton';

const PAGE = 20;

/** Where the next page starts: Following continues from a cursor, Nearby from an offset. */
type Next = FeedCursor | number | null;

interface Page {
  items: FeedItem[];
  next: Next;
}

async function fetchPage(mode: 'following' | 'nearby', next: Next | undefined): Promise<Page> {
  const client = getSupabase();
  if (mode === 'following') {
    // The cursor goes back exactly as it came: its time has microseconds a Date would lose.
    const page = await getFollowingFeed(
      client,
      (next as FeedCursor | undefined) ?? undefined,
      PAGE,
    );
    return { items: page.items, next: page.next };
  }
  const page = await getNearbyFeed(client, (next as number | undefined) ?? 0, PAGE);
  return { items: page.items, next: page.nextOffset };
}

interface FeedListProps {
  mode: 'following' | 'nearby';
}

/**
 * The Following or Nearby feed: cards, 20 at a time, with pull to refresh, infinite scroll and the
 * right empty message. Nearby means the home city; without one it asks for a city and loads nothing.
 */
export function FeedList({ mode }: FeedListProps) {
  const { profile, refreshProfile } = useSession();
  const homeCityId = profile?.homeCity?.id ?? null;
  const city = profile?.homeCity ? cityName(profile.homeCity.label) : null;
  const followingCount = profile?.counts.following ?? 0;
  const needsCity = mode === 'nearby' && homeCityId === null;
  // Nearby is relative to the home city, so changing it starts the feed over; Following ignores it.
  const cityKey = mode === 'nearby' ? homeCityId : null;

  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  // Refs mirror what the callbacks need without making them change on every render.
  const itemsRef = useRef<FeedItem[] | null>(null);
  const nextRef = useRef<Next>(null);
  const loadId = useRef(0);
  const moreInFlight = useRef(false);
  const focusedBefore = useRef(false);
  const refreshProfileRef = useRef(refreshProfile);
  refreshProfileRef.current = refreshProfile;

  /** Loads the first page. Rejection is shown, not thrown; older answers are dropped. */
  const reload = useCallback(
    async (pulled = false) => {
      const id = ++loadId.current;
      moreInFlight.current = false;
      setLoadingMore(false);
      setMoreError(null);
      setError(null);
      if (pulled) setRefreshing(true);
      try {
        const page = await fetchPage(mode, undefined);
        if (id !== loadId.current) return;
        itemsRef.current = page.items;
        nextRef.current = page.next;
        setItems(page.items);
        // An empty Following feed is worded by how many people you follow, so make that current.
        if (mode === 'following' && page.items.length === 0)
          refreshProfileRef.current().catch(() => {});
      } catch (e) {
        if (id === loadId.current) setError(friendlyMessage(e));
      } finally {
        if (id === loadId.current) setRefreshing(false);
      }
    },
    [mode],
  );

  const loadMore = useCallback(async () => {
    if (moreInFlight.current || nextRef.current === null || itemsRef.current === null) return;
    moreInFlight.current = true;
    const id = loadId.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchPage(mode, nextRef.current);
      if (id !== loadId.current) return;
      // Nearby's ranking moves between requests, so a later page can repeat a card.
      const merged = appendUniqueByKey(itemsRef.current ?? [], page.items);
      itemsRef.current = merged;
      nextRef.current = page.next;
      setItems(merged);
    } catch (e) {
      if (id === loadId.current) setMoreError(friendlyMessage(e));
    } finally {
      if (id === loadId.current) {
        moreInFlight.current = false;
        setLoadingMore(false);
      }
    }
  }, [mode]);

  // The first load, and again when the home city changes (Nearby is relative to it).
  useEffect(() => {
    if (needsCity) {
      itemsRef.current = [];
      nextRef.current = null;
      setItems([]);
      return;
    }
    void reload();
  }, [reload, needsCity, cityKey]);

  // Coming back to an empty (or failed) feed, say after following someone, looks again.
  useFocusEffect(
    useCallback(() => {
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return;
      }
      if (needsCity) return;
      if (itemsRef.current === null || itemsRef.current.length === 0) void reload();
    }, [reload, needsCity]),
  );

  const variant: FeedEmptyVariant =
    mode === 'nearby'
      ? needsCity
        ? 'nearby-no-city'
        : 'nearby-empty'
      : followingCount === 0
        ? 'following-nobody'
        : 'following-none';

  const failed = items === null && error !== null;
  const list = items ?? [];

  return (
    <FlatList<FeedItem>
      testID="feed-list"
      data={list}
      keyExtractor={(item) => item.key}
      renderItem={({ item }) => <FeedCard item={item} />}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => (needsCity ? Promise.resolve() : reload(true))}
          tintColor={colors.smoke}
          colors={[colors.emberGlow]}
        />
      }
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <>
          <PhotoNotice style={styles.notice} />
          {error && !failed ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </>
      }
      ListEmptyComponent={
        failed ? (
          <View style={styles.problemBox}>
            <Text style={styles.problem} accessibilityRole="alert">
              {error}
            </Text>
            <PrimaryButton label="Try again" onPress={() => void reload()} />
          </View>
        ) : items === null ? (
          <ActivityIndicator
            testID="feed-loading"
            color={colors.emberGlow}
            style={styles.spinner}
          />
        ) : (
          <FeedEmpty variant={variant} cityName={city} />
        )
      }
      ListFooterComponent={
        moreError ? (
          <View style={styles.problemBox}>
            <Text style={styles.problem} accessibilityRole="alert">
              {moreError}
            </Text>
            <PrimaryButton label="Try again" onPress={() => void loadMore()} />
          </View>
        ) : loadingMore ? (
          <ActivityIndicator testID="feed-more" color={colors.emberGlow} style={styles.spinner} />
        ) : undefined
      }
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 32 },
  gap: { height: 14 },
  notice: { marginBottom: 14 },
  error: {
    paddingHorizontal: 8,
    paddingBottom: 12,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
  },
  problemBox: { alignItems: 'stretch', gap: 16, paddingHorizontal: 20, paddingTop: 24 },
  problem: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 15,
    color: colors.bone,
    textAlign: 'center',
  },
  spinner: { paddingTop: 32 },
});
