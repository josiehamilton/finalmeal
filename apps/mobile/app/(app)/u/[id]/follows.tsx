import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, getProfile, listFollowers, listFollowing } from '@finalmeal/api';
import type { PersonRow as PersonRowData, ProfileView } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { PersonRow } from '../../../../src/components/PersonRow';
import { PrimaryButton } from '../../../../src/components/PrimaryButton';
import { ScreenHeader } from '../../../../src/components/ScreenHeader';
import { SEARCH_DEBOUNCE_MS, SearchField } from '../../../../src/components/SearchField';
import { fontFamily } from '../../../../src/lib/fonts';
import { getSupabase } from '../../../../src/lib/supabase';
import { syncFollowStates } from '../../../../src/state/follow-store';

type FollowsTab = 'followers' | 'following';

const PAGE = 20;

/** One person's followers or the people they follow, 20 at a time (the Followers board). */
export default function Follows() {
  const router = useRouter();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<FollowsTab>(tabParam === 'following' ? 'following' : 'followers');
  const [profile, setProfile] = useState<ProfileView | null | undefined>(undefined);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [text, setText] = useState('');
  // What the list was last asked for; follows `text` after a pause.
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PersonRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Separate counters: retrying the list must not blank the screen to refetch the profile.
  const [profileTries, setProfileTries] = useState(0);
  const [listTries, setListTries] = useState(0);
  // Only the newest request may change the list: a slower, older one must not overwrite it.
  const request = useRef(0);
  const loadingMore = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    setProfileError(null);
    getProfile(getSupabase(), id)
      .then((loaded) => {
        if (!cancelled) setProfile(loaded);
      })
      .catch((e) => {
        if (cancelled) return;
        setProfileError(friendlyMessage(e));
        setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id, profileTries]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const fetchPage = useCallback(
    (offset: number) => {
      const list = tab === 'followers' ? listFollowers : listFollowing;
      return list(getSupabase(), id, { q: query === '' ? undefined : query, offset, limit: PAGE });
    },
    [id, tab, query],
  );

  // A new tab, search or retry starts the list again from the top.
  const ready = profile !== undefined && profile !== null;
  // A private account the viewer may not see has no list to show, only the private message.
  const mayList = ready && (profile.canSeePicks || profile.isMe);
  useEffect(() => {
    if (!ready || !mayList) return;
    const mine = ++request.current;
    loadingMore.current = false;
    setLoading(true);
    setError(null);
    setRows([]);
    setMore(false);
    fetchPage(0)
      .then((page) => {
        if (mine !== request.current) return;
        syncFollowStates(page);
        setRows(page);
        setMore(page.length === PAGE);
      })
      .catch((e) => {
        if (mine === request.current) setError(friendlyMessage(e));
      })
      .finally(() => {
        if (mine === request.current) setLoading(false);
      });
    return () => {
      // Leaving also stops a slow request from setting state afterwards.
      request.current++;
    };
  }, [fetchPage, ready, mayList, listTries]);

  function loadMore() {
    if (!more || loading || loadingMore.current) return;
    loadingMore.current = true;
    setError(null);
    const mine = request.current;
    fetchPage(rows.length)
      .then((page) => {
        if (mine !== request.current) return;
        syncFollowStates(page);
        // The list is newest first, so a follow between pages can repeat a row: keep the first.
        setRows((current) => {
          const have = new Set(current.map((row) => row.id));
          return [...current, ...page.filter((row) => !have.has(row.id))];
        });
        setMore(page.length === PAGE);
      })
      .catch((e) => {
        if (mine === request.current) setError(friendlyMessage(e));
      })
      .finally(() => {
        loadingMore.current = false;
      });
  }

  function switchTab(next: FollowsTab) {
    if (next === tab) return;
    setText('');
    setQuery('');
    setTab(next);
  }

  const title = profile ? `@${profile.username}` : '';
  const tabs: { key: FollowsTab; label: string }[] = [
    { key: 'followers', label: profile ? `${profile.counts.followers} Followers` : 'Followers' },
    { key: 'following', label: profile ? `${profile.counts.following} Following` : 'Following' },
  ];
  const empty =
    query !== ''
      ? `No one matches “${query}”.`
      : tab === 'followers'
        ? 'No followers yet.'
        : 'Not following anyone yet.';

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader title={title} onBack={() => router.back()} />
      {profile === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator testID="follows-loading" color={colors.emberGlow} />
        </View>
      ) : profile === null ? (
        <View style={styles.center}>
          <Text style={styles.problem} accessibilityRole={profileError ? 'alert' : undefined}>
            {profileError ?? 'This profile isn’t available.'}
          </Text>
          {profileError ? (
            <PrimaryButton label="Try again" onPress={() => setProfileTries((n) => n + 1)} />
          ) : null}
        </View>
      ) : !mayList ? (
        <View style={styles.private}>
          <Text style={styles.privateTitle} accessibilityRole="header">
            This account is private
          </Text>
          <Text style={styles.privateBody}>
            {profile.viewerFollow === 'requested'
              ? 'Your request is waiting for approval.'
              : 'Follow to see their picks.'}
          </Text>
        </View>
      ) : (
        <>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {tabs.map(({ key, label }) => {
              const on = tab === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on }}
                  onPress={() => switchTab(key)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.search}>
            <SearchField
              value={text}
              onChangeText={setText}
              label={tab === 'followers' ? 'Search followers' : 'Search following'}
            />
          </View>
          <FlatList
            testID="people-list"
            data={rows}
            keyExtractor={(row) => row.id}
            renderItem={({ item }) => (
              <PersonRow person={item} onOpen={(personId) => router.push(`/u/${personId}`)} />
            )}
            keyboardShouldPersistTaps="handled"
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator testID="follows-list-loading" color={colors.emberGlow} />
              ) : error ? (
                <View style={styles.problemBox}>
                  <Text style={styles.problem} accessibilityRole="alert">
                    {error}
                  </Text>
                  <PrimaryButton label="Try again" onPress={() => setListTries((n) => n + 1)} />
                </View>
              ) : (
                <Text style={styles.empty}>{empty}</Text>
              )
            }
            ListFooterComponent={
              rows.length > 0 && error ? (
                <View style={styles.problemBox}>
                  <Text style={styles.footerError} accessibilityRole="alert">
                    {error}
                  </Text>
                  <PrimaryButton label="Try again" onPress={loadMore} />
                </View>
              ) : undefined
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 32,
  },
  problem: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 15,
    color: colors.bone,
    textAlign: 'center',
  },
  private: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingTop: 56 },
  privateTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 22,
    lineHeight: 22 * 1.2,
    color: colors.bone,
    textAlign: 'center',
  },
  privateBody: {
    fontFamily: fontFamily.ui,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.smoke,
    textAlign: 'center',
  },
  problemBox: { alignItems: 'center', gap: 20, paddingTop: 32 },
  tabs: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabOn: { borderBottomColor: colors.emberGlow },
  tabText: { fontFamily: fontFamily.uiBold, fontSize: 14, color: colors.dim },
  tabTextOn: { color: colors.bone },
  search: { paddingHorizontal: 20, paddingTop: 14 },
  list: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32 },
  empty: {
    paddingTop: 32,
    fontFamily: fontFamily.ui,
    fontSize: 15,
    color: colors.smoke,
    textAlign: 'center',
  },
  footerError: {
    paddingTop: 12,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
});
