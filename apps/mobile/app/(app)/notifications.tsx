import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ApiError,
  friendlyMessage,
  getMyNotifications,
  getUnreadCount,
  markNotificationsRead,
  respondToFollowRequest,
  subscribeToMyNotifications,
} from '@finalmeal/api';
import type { ActivityItem } from '@finalmeal/api';
import { isSameLocalDay } from '@finalmeal/core';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { ActivityRow } from '../../src/components/ActivityRow';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { useSession } from '../../src/providers/SessionProvider';
import { syncFollowStates } from '../../src/state/follow-store';

const PAGE = 20;

interface Section {
  title: 'Today' | 'Earlier';
  data: ActivityItem[];
}

function without(set: ReadonlySet<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

function withIds(set: ReadonlySet<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(set);
  for (const id of ids) next.add(id);
  return next;
}

/** Where a tap on this activity goes: the pick, the person, or nowhere (lists are Phase 6). */
function destinationOf(item: ActivityItem): string | null {
  switch (item.type) {
    case 'followed':
    case 'follow_requested':
    case 'follow_accepted':
      return `/u/${item.actor.id}`;
    case 'saved_from_list':
      return null;
    default:
      return item.pickId ? `/pick/${item.pickId}` : null;
  }
}

/** Activity: follows, requests, saves and the changes to the Final Meals you follow. */
export default function Activity() {
  const router = useRouter();
  const { profile } = useSession();
  const userId = profile?.id;

  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);
  // What this screen has changed since it loaded: rows read, requests approved or being answered.
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<ReadonlySet<string>>(new Set());
  const [respondingIds, setRespondingIds] = useState<ReadonlySet<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  // How many the server says are unread (null: unknown), which can be more than is loaded.
  const [serverUnread, setServerUnread] = useState<number | null>(null);

  const itemsRef = useRef<ActivityItem[] | null>(null);
  // Where the next page starts: the time of the last notification fetched (a timestamp only).
  const nextRef = useRef<string | null>(null);
  const loadId = useRef(0);
  const moreInFlight = useRef(false);
  // While a next page has failed, scrolling must not ask again; only Try again does.
  const moreErrorRef = useRef(false);
  const mounted = useRef(true);
  // Notifications this screen has seen go (declined, or a request that was withdrawn): a refresh
  // that started before they went must not bring them back.
  const removedRef = useRef(new Set<string>());
  const refreshing = useRef(false);
  const refreshAgain = useRef(false);
  // Counts successful Mark all reads, so a page that was on its way when one landed is read too.
  const markAllCount = useRef(0);

  const show = useCallback((next: ActivityItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  /** Loads the first page. A failure is shown, not thrown; older answers are dropped. */
  const reload = useCallback(async () => {
    const id = ++loadId.current;
    moreInFlight.current = false;
    moreErrorRef.current = false;
    nextRef.current = null;
    setLoadingMore(false);
    setMoreError(null);
    setError(null);
    getUnreadCount(getSupabase()).then(
      (count) => {
        if (mounted.current && id === loadId.current) setServerUnread(count);
      },
      () => {
        // Without the count the button follows the rows that are loaded.
      },
    );
    try {
      const page = await getMyNotifications(getSupabase(), { limit: PAGE });
      if (!mounted.current || id !== loadId.current) return;
      syncFollowStates(page.map((n) => ({ id: n.actor.id, viewerFollow: n.viewerFollow })));
      nextRef.current = page.length >= PAGE ? (page[page.length - 1]?.at ?? null) : null;
      show(page);
    } catch (e) {
      if (mounted.current && id === loadId.current) setError(friendlyMessage(e));
    }
  }, [show]);

  const loadMore = useCallback(
    async (retry = false) => {
      if (moreInFlight.current || nextRef.current === null || itemsRef.current === null) return;
      if (moreErrorRef.current && !retry) return;
      moreInFlight.current = true;
      moreErrorRef.current = false;
      const id = loadId.current;
      const readAllsBefore = markAllCount.current;
      setLoadingMore(true);
      setMoreError(null);
      try {
        const page = await getMyNotifications(getSupabase(), {
          before: nextRef.current,
          limit: PAGE,
        });
        if (!mounted.current || id !== loadId.current) return;
        syncFollowStates(page.map((n) => ({ id: n.actor.id, viewerFollow: n.viewerFollow })));
        const have = new Set((itemsRef.current ?? []).map((n) => n.id));
        const added = page.filter((n) => !have.has(n.id) && !removedRef.current.has(n.id));
        nextRef.current = page.length >= PAGE ? (page[page.length - 1]?.at ?? null) : null;
        // A Mark all read landed while this page was on its way: the server already read these.
        if (markAllCount.current !== readAllsBefore) {
          setReadIds((prev) =>
            withIds(
              prev,
              added.map((n) => n.id),
            ),
          );
        }
        show([...(itemsRef.current ?? []), ...added]);
      } catch (e) {
        if (mounted.current && id === loadId.current) {
          moreErrorRef.current = true;
          setMoreError(friendlyMessage(e));
        }
      } finally {
        if (mounted.current && id === loadId.current) {
          moreInFlight.current = false;
          setLoadingMore(false);
        }
      }
    },
    [show],
  );

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  /**
   * Looks at the newest notifications again and merges them in: new ones on top, ones that have
   * gone dropped (the page replaces what it covers; older rows stay). One look at a time; arrivals
   * during one cause a single further look.
   */
  const refresh = useCallback(async () => {
    if (refreshing.current) {
      refreshAgain.current = true;
      return;
    }
    refreshing.current = true;
    try {
      do {
        refreshAgain.current = false;
        const id = loadId.current;
        try {
          const [page, count] = await Promise.all([
            getMyNotifications(getSupabase(), { limit: PAGE }),
            getUnreadCount(getSupabase()).catch(() => null),
          ]);
          const current = itemsRef.current;
          if (!mounted.current || id !== loadId.current || current === null) continue;
          if (count !== null) setServerUnread(count);
          syncFollowStates(page.map((n) => ({ id: n.actor.id, viewerFollow: n.viewerFollow })));
          const fresh = page.filter((n) => !removedRef.current.has(n.id));
          if (page.length < PAGE) {
            nextRef.current = null;
            show(fresh);
          } else {
            const last = page[page.length - 1]!;
            const inPage = new Set(page.map((n) => n.id));
            const cutoff = Date.parse(last.at);
            const older = current.filter(
              (n) =>
                !inPage.has(n.id) && !removedRef.current.has(n.id) && Date.parse(n.at) <= cutoff,
            );
            if (nextRef.current === null && older.length === 0) nextRef.current = last.at;
            show([...fresh, ...older]);
          }
        } catch {
          // The list stays as it is; the next arrival or a reopen looks again.
        }
      } while (refreshAgain.current && mounted.current);
    } finally {
      refreshing.current = false;
    }
  }, [show]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToMyNotifications(getSupabase(), userId, () => void refresh());
  }, [userId, refresh]);

  const isUnread = useCallback(
    (item: ActivityItem) => item.readAt === null && !readIds.has(item.id),
    [readIds],
  );
  const loadedUnread = (items ?? []).filter(isUnread).length;
  const canMarkAll = loadedUnread > 0 || (serverUnread ?? 0) > 0;

  const now = useMemo(() => new Date(), [items]);
  const sections = useMemo<Section[]>(() => {
    const list = items ?? [];
    const today = list.filter((n) => isSameLocalDay(n.at, now));
    const earlier = list.filter((n) => !isSameLocalDay(n.at, now));
    const out: Section[] = [];
    if (today.length > 0) out.push({ title: 'Today', data: today });
    if (earlier.length > 0) out.push({ title: 'Earlier', data: earlier });
    return out;
  }, [items, now]);

  async function markAllRead() {
    if (!canMarkAll) return;
    const unread = (itemsRef.current ?? []).filter(isUnread).map((n) => n.id);
    const before = serverUnread;
    setMarkError(null);
    setReadIds((prev) => withIds(prev, unread));
    setServerUnread(0);
    try {
      await markNotificationsRead(getSupabase());
      if (!mounted.current) return;
      markAllCount.current++;
      // Rows that arrived while this was going are read now too.
      setReadIds((prev) =>
        withIds(
          prev,
          (itemsRef.current ?? []).map((n) => n.id),
        ),
      );
    } catch (e) {
      if (!mounted.current) return;
      setReadIds((prev) => without(prev, unread));
      setServerUnread(before);
      setMarkError(friendlyMessage(e));
    }
  }

  function open(item: ActivityItem) {
    if (isUnread(item)) {
      setReadIds((prev) => withIds(prev, [item.id]));
      setServerUnread((n) => (n === null ? null : Math.max(0, n - 1)));
      // The dot is a hint: if this fails it comes back on the next look, and the tap still opens.
      markNotificationsRead(getSupabase(), [item.id]).catch(() => {});
    }
    const href = destinationOf(item);
    if (href) router.push(href as never);
  }

  function removeRow(id: string) {
    removedRef.current.add(id);
    show((itemsRef.current ?? []).filter((n) => n.id !== id));
  }

  async function respond(item: ActivityItem, accept: boolean) {
    if (respondingIds.has(item.id)) return;
    setRespondingIds((prev) => withIds(prev, [item.id]));
    setRowErrors((prev) => {
      const rest = { ...prev };
      delete rest[item.id];
      return rest;
    });
    try {
      await respondToFollowRequest(getSupabase(), item.actor.id, accept);
      if (!mounted.current) return;
      if (accept) {
        setApprovedIds((prev) => withIds(prev, [item.id]));
      } else {
        removeRow(item.id);
      }
    } catch (e) {
      if (!mounted.current) return;
      // The person withdrew the request in the meantime: nothing is left to answer.
      if (e instanceof ApiError && e.code === 'request_not_found') removeRow(item.id);
      else setRowErrors((prev) => ({ ...prev, [item.id]: friendlyMessage(e) }));
    } finally {
      if (mounted.current) setRespondingIds((prev) => without(prev, [item.id]));
    }
  }

  const failed = error !== null && (items === null || items.length === 0);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen} testID="activity-screen">
      <ScreenHeader
        title="Activity"
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all read"
            accessibilityState={{ disabled: !canMarkAll }}
            disabled={!canMarkAll}
            onPress={() => void markAllRead()}
            hitSlop={8}
          >
            <Text style={[styles.markAll, !canMarkAll && styles.markAllOff]}>Mark all read</Text>
          </Pressable>
        }
      />
      {markError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {markError}
        </Text>
      ) : null}
      <SectionList<ActivityItem, Section>
        testID="activity-list"
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionLabel} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <ActivityRow
            item={item}
            unread={isUnread(item)}
            now={now}
            onOpen={open}
            onRespond={(n, accept) => void respond(n, accept)}
            approved={approvedIds.has(item.id)}
            responding={respondingIds.has(item.id)}
            error={rowErrors[item.id] ?? null}
          />
        )}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={
          failed ? (
            <View style={styles.box}>
              <Text style={styles.problem} accessibilityRole="alert">
                {error}
              </Text>
              <PrimaryButton label="Try again" onPress={() => void reload()} />
            </View>
          ) : items === null ? (
            <ActivityIndicator
              testID="activity-loading"
              color={colors.emberGlow}
              style={styles.spinner}
            />
          ) : (
            <View style={styles.box}>
              <Text style={styles.emptyTitle}>No activity yet.</Text>
              <Text style={styles.emptyBody}>
                When people follow you or save your picks, it shows up here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          moreError ? (
            <View style={styles.box}>
              <Text style={styles.problem} accessibilityRole="alert">
                {moreError}
              </Text>
              <PrimaryButton label="Try again" onPress={() => void loadMore(true)} />
            </View>
          ) : loadingMore ? (
            <ActivityIndicator
              testID="activity-more"
              color={colors.emberGlow}
              style={styles.spinner}
            />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  content: { flexGrow: 1, paddingBottom: 32 },
  markAll: { fontFamily: fontFamily.uiBold, fontSize: 13, color: colors.smoke },
  markAllOff: { color: colors.dim, opacity: 0.6 },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  error: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
  },
  box: { alignItems: 'stretch', gap: 12, paddingHorizontal: 20, paddingTop: 40 },
  problem: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 15,
    color: colors.bone,
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamily.display,
    fontSize: 24,
    color: colors.bone,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamily.ui,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.smoke,
    textAlign: 'center',
  },
  spinner: { paddingTop: 32 },
});
