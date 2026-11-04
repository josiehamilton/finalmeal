import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, getMyPicks, getProfile, getProfilePicks } from '@finalmeal/api';
import type { Pick, ProfileView } from '@finalmeal/api';
import { chipOptions, filterPicks, groupPicksByPlace } from '@finalmeal/core';
import type { ChipOption, PickFilter } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { FilterChips, chipKey } from '../../../src/components/FilterChips';
import { FinalMealList } from '../../../src/components/FinalMealList';
import { HonorableList } from '../../../src/components/HonorableList';
import { OtherProfileHeader } from '../../../src/components/OtherProfileHeader';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { SharedTaste } from '../../../src/components/SharedTaste';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/providers/SessionProvider';
import { useFollow } from '../../../src/state/follow';

type ProfileTab = 'final' | 'honorable';

// No Map tab on other people's profiles until Phase 5 builds the map.
const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'final', label: 'Final Meal' },
  { key: 'honorable', label: 'Honorable' },
];

/** The chip as the `filterPicks` filter it stands for. Others' personal tags never reach it. */
function filterFor(chip: ChipOption | null): PickFilter {
  if (!chip) return {};
  if (chip.kind === 'city') return { city: chip.value };
  return { tagSlug: chip.value };
}

interface BodyProps {
  view: ProfileView;
  refreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
}

/** A loaded profile. Its picks load only when the server says the viewer may see them. */
function OtherProfileBody({ view, refreshing, refreshError, onRefresh }: BodyProps) {
  const router = useRouter();
  const follow = useFollow(view);
  const [tab, setTab] = useState<ProfileTab>('final');
  const [chosenChip, setChosenChip] = useState<ChipOption | null>(null);
  const [theirs, setTheirs] = useState<Pick[] | null>(null);
  const [mine, setMine] = useState<Pick[]>([]);
  const [picksError, setPicksError] = useState<string | null>(null);
  const [picksTry, setPicksTry] = useState(0);

  // A private account you do not follow shows the header only; the picks are never asked for.
  const mayLoadPicks = view.canSeePicks;
  useEffect(() => {
    if (!mayLoadPicks) return;
    let cancelled = false;
    setPicksError(null);
    Promise.all([
      getProfilePicks(getSupabase(), view.id),
      // Your own list only feeds the shared-taste line; without it that line is just left out.
      getMyPicks(getSupabase()).catch((): Pick[] => []),
    ])
      .then(([their, my]) => {
        if (cancelled) return;
        setTheirs(their);
        setMine(my);
      })
      .catch((e) => {
        if (!cancelled) setPicksError(friendlyMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [view, mayLoadPicks, picksTry]);

  // Unfollowing a private account takes its picks away at once, before any reload.
  const canSee = view.canSeePicks && (view.visibility === 'public' || follow.state === 'active');
  // The follower count moves by one the moment you follow or unfollow.
  const followers =
    view.counts.followers -
    (view.viewerFollow === 'active' ? 1 : 0) +
    (follow.state === 'active' ? 1 : 0);

  const picks = canSee ? theirs : null;
  const finals = useMemo(() => (picks ?? []).filter((p) => p.tier === 'final'), [picks]);
  const options = useMemo(() => chipOptions(picks ?? []), [picks]);
  const chip = useMemo(
    () => (chosenChip ? (options.find((o) => chipKey(o) === chipKey(chosenChip)) ?? null) : null),
    [options, chosenChip],
  );
  const matching = useMemo(() => filterPicks(picks ?? [], filterFor(chip)), [picks, chip]);
  const matchingIds = useMemo(() => new Set(matching.map((p) => p.id)), [matching]);
  const dimmedIds = useMemo(
    () => (chip ? new Set(finals.filter((p) => !matchingIds.has(p.id)).map((p) => p.id)) : null),
    [chip, finals, matchingIds],
  );
  const matchingFinals = useMemo(
    () => matching.filter((p) => p.tier === 'final').length,
    [matching],
  );
  const matchingHonorables = useMemo(
    () => matching.filter((p) => p.tier === 'honorable'),
    [matching],
  );
  const groups = useMemo(() => groupPicksByPlace(matchingHonorables), [matchingHonorables]);

  function openPick(pick: Pick) {
    router.push(`/pick/${pick.id}`);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.smoke}
          colors={[colors.emberGlow]}
        />
      }
    >
      <OtherProfileHeader
        profile={view}
        follow={follow}
        followers={followers}
        linkStats={canSee}
        onOpenFollowers={() => router.push(`/u/${view.id}/follows?tab=followers`)}
        onOpenFollowing={() => router.push(`/u/${view.id}/follows?tab=following`)}
      >
        {canSee && picks ? <SharedTaste mine={mine} theirs={picks} /> : null}
      </OtherProfileHeader>
      {refreshError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {refreshError}
        </Text>
      ) : null}
      {!canSee ? (
        <View style={styles.private}>
          <Text style={styles.privateTitle} accessibilityRole="header">
            This account is private
          </Text>
          <Text style={styles.privateBody}>
            {follow.state === 'requested'
              ? 'Your request is waiting for approval.'
              : 'Follow to see their picks.'}
          </Text>
        </View>
      ) : (
        <>
          <View accessibilityRole="tablist" style={styles.tabs}>
            {TABS.map(({ key, label }) => {
              const on = tab === key;
              const count = key === 'final' ? matchingFinals : matchingHonorables.length;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityLabel={`${label} ${count}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => setTab(key)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>
                    {label}
                    <Text style={styles.tabCount}>{` ${count}`}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {options.length > 0 ? (
            <View style={styles.filters}>
              <FilterChips options={options} selected={chip} onSelect={setChosenChip} />
            </View>
          ) : null}
          <View style={styles.panel}>
            {picks === null ? (
              picksError ? (
                <>
                  <Text style={styles.error} accessibilityRole="alert">
                    {picksError}
                  </Text>
                  <PrimaryButton label="Try again" onPress={() => setPicksTry((n) => n + 1)} />
                </>
              ) : (
                <ActivityIndicator testID="picks-loading" color={colors.emberGlow} />
              )
            ) : tab === 'final' ? (
              finals.length > 0 ? (
                <FinalMealList picks={finals} dimmedIds={dimmedIds} onOpen={openPick} />
              ) : (
                <Text style={styles.empty}>
                  {chip ? 'No Final Meal dishes match this filter.' : 'No Final Meal dishes yet.'}
                </Text>
              )
            ) : groups.length > 0 ? (
              <HonorableList groups={groups} onOpen={openPick} />
            ) : (
              <Text style={styles.empty}>
                {chip ? 'No honorable mentions match this filter.' : 'No honorable mentions yet.'}
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** Someone else's profile, pushed over the tabs (the OtherProfile board). */
export default function OtherProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useSession();
  const isMine = me?.id === id;
  // undefined: not loaded yet. null: there is no such person, or a block hides them.
  const [view, setView] = useState<ProfileView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (silent: boolean) => {
      const request = ++latest.current;
      if (!silent) {
        setView(undefined);
        setError(null);
      }
      try {
        const loaded = await getProfile(getSupabase(), id);
        if (request !== latest.current) return;
        setView(loaded);
        setError(null);
      } catch (e) {
        if (request !== latest.current) return;
        setError(friendlyMessage(e));
        if (!silent) setView(null);
      }
    },
    [id],
  );

  useEffect(() => {
    if (isMine) return;
    void load(false);
    return () => {
      latest.current++;
    };
  }, [load, isMine]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  // Your own id is the You tab.
  if (isMine || view?.isMe) return <Redirect href="/you" />;

  const loadFailed = view === null && error !== null;
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader title={view ? `@${view.username}` : ''} onBack={() => router.back()} />
      {view === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator testID="profile-loading" color={colors.emberGlow} />
        </View>
      ) : view === null ? (
        <View style={styles.center}>
          <Text style={styles.problem} accessibilityRole={loadFailed ? 'alert' : undefined}>
            {loadFailed ? error : 'This profile isn’t available.'}
          </Text>
          {loadFailed ? <PrimaryButton label="Try again" onPress={() => void load(false)} /> : null}
        </View>
      ) : (
        <OtherProfileBody
          view={view}
          refreshing={refreshing}
          refreshError={error}
          onRefresh={() => void refresh()}
        />
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
  content: { paddingBottom: 32 },
  error: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
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
  tabCount: { fontFamily: fontFamily.uiSemiBold, color: colors.dim },
  filters: { gap: 10, paddingTop: 12, paddingBottom: 6 },
  panel: { gap: 16, paddingHorizontal: 20, paddingTop: 20 },
  empty: {
    paddingTop: 24,
    fontFamily: fontFamily.ui,
    fontSize: 15,
    color: colors.smoke,
    textAlign: 'center',
  },
});
