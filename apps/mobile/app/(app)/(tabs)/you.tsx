import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { friendlyMessage, getMyPicks } from '@finalmeal/api';
import type { Pick } from '@finalmeal/api';
import {
  chipOptions,
  filterPicks,
  groupPicksByPlace,
  summarizeGroups,
} from '@finalmeal/core';
import type { ChipOption, PickFilter } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { FilterChips, chipKey } from '../../../src/components/FilterChips';
import { FinalMealList } from '../../../src/components/FinalMealList';
import { HonorableList } from '../../../src/components/HonorableList';
import { Icon } from '../../../src/components/Icon';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ProfileHeader } from '../../../src/components/ProfileHeader';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/providers/SessionProvider';
import { dismissPhotoNotice, usePhotoNotice, usePicksVersion } from '../../../src/state/pick-changes';

type ProfileTab = 'final' | 'honorable' | 'map';

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'final', label: 'Final Meal' },
  { key: 'honorable', label: 'Honorable' },
  { key: 'map', label: 'Map' },
];

/** The chip as the `filterPicks` filter it stands for. */
function filterFor(chip: ChipOption | null): PickFilter {
  if (!chip) return {};
  if (chip.kind === 'city') return { city: chip.value };
  return chip.tagKind === 'personal' ? { personalTagSlug: chip.value } : { tagSlug: chip.value };
}

export default function You() {
  const router = useRouter();
  const { profile, loading, error: sessionError, refreshProfile } = useSession();
  const [tab, setTab] = useState<ProfileTab>('final');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [picksLoading, setPicksLoading] = useState(true);
  const [chosenChip, setChosenChip] = useState<ChipOption | null>(null);
  // Only the newest load may set the picks: an older, slower one must not overwrite it.
  const loadId = useRef(0);

  // A save, swap, move or removal elsewhere changed the picks: refresh the profile's dish count.
  const picksVersion = usePicksVersion();
  const seenVersion = useRef(picksVersion);
  const photoNotice = usePhotoNotice();

  /** Loads the person's picks. Rejects when they cannot be loaded, keeping any picks already shown. */
  async function loadPicks() {
    const id = ++loadId.current;
    const loaded = await getMyPicks(getSupabase());
    if (id !== loadId.current) return;
    setPicks(loaded);
  }

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      await Promise.all([refreshProfile(), loadPicks()]);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setRefreshing(false);
    }
  }

  // The first load, once there is a profile. Later loads come from refresh().
  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setPicksLoading(true);
    loadPicks()
      .catch((e) => {
        if (!cancelled) setError(friendlyMessage(e));
      })
      .finally(() => {
        if (!cancelled) setPicksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    if (picksVersion === seenVersion.current) return;
    seenVersion.current = picksVersion;
    void refresh();
  }, [picksVersion]);

  const finals = useMemo(() => (picks ?? []).filter((p) => p.tier === 'final'), [picks]);
  const options = useMemo(() => chipOptions(picks ?? []), [picks]);
  // A filter whose chip has gone (its last pick was removed) falls back to All.
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
  const matchingFinals = useMemo(() => matching.filter((p) => p.tier === 'final').length, [matching]);
  const matchingHonorables = useMemo(() => matching.filter((p) => p.tier === 'honorable'), [matching]);
  const groups = useMemo(() => groupPicksByPlace(matchingHonorables), [matchingHonorables]);
  const summary = useMemo(
    () => (chip ? `${chip.label} · ${summarizeGroups(groupPicksByPlace(matching))}` : null),
    [chip, matching],
  );

  function openPick(pick: Pick) {
    router.push(`/pick/${pick.id}`);
  }
  function addFinal() {
    router.navigate({ pathname: '/add', params: { tier: 'final' } });
  }

  if (!profile) {
    // No profile to show: never a blank screen. Say why and offer a retry.
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={styles.center}>
          {refreshing || loading ? (
            <ActivityIndicator testID="you-loading" color={colors.emberGlow} />
          ) : (
            <>
              <Text style={styles.problem} accessibilityRole="alert">
                {error ?? sessionError ?? friendlyMessage(null)}
              </Text>
              <PrimaryButton label="Try again" onPress={refresh} />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.handle} accessibilityRole="header">{`@${profile.username}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          hitSlop={4}
          style={styles.iconButton}
        >
          <Icon name="sliders" size={21} color={colors.bone} />
        </Pressable>
      </View>
      <ScrollView
        testID="you-scroll"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.smoke}
            colors={[colors.emberGlow]}
          />
        }
      >
        <ProfileHeader
          profile={profile}
          dishes={picks?.length}
          onEdit={() => router.push('/settings/edit-profile')}
        />
        {photoNotice ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Text style={styles.noticeText}>
              Saved without the photo. Add it from the dish any time.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={dismissPhotoNotice}
              hitSlop={8}
            >
              <Icon name="close" size={18} color={colors.smoke} />
            </Pressable>
          </View>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View accessibilityRole="tablist" style={styles.tabs}>
          {TABS.map(({ key, label }) => {
            const on = tab === key;
            const count =
              key === 'final' ? matchingFinals : key === 'honorable' ? matchingHonorables.length : null;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={count === null ? label : `${label} ${count}`}
                accessibilityState={{ selected: on }}
                onPress={() => setTab(key)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {label}
                  {count === null ? null : <Text style={styles.tabCount}>{` ${count}`}</Text>}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {tab !== 'map' && options.length > 0 ? (
          <View style={styles.filters}>
            <FilterChips options={options} selected={chip} onSelect={setChosenChip} />
            {summary ? (
              <View style={styles.summaryRow}>
                {/* "Share these" joins this row in Phase 6, when sharing lists exists. */}
                <Text style={styles.summary}>{summary}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.panel}>
          {tab === 'map' ? (
            <Text style={styles.empty}>Your map fills in as you add dishes.</Text>
          ) : picks === null ? (
            picksLoading || refreshing ? (
              <ActivityIndicator testID="picks-loading" color={colors.emberGlow} />
            ) : (
              <PrimaryButton label="Try again" onPress={refresh} />
            )
          ) : tab === 'final' ? (
            <FinalMealList picks={finals} dimmedIds={dimmedIds} onOpen={openPick} onAdd={addFinal} />
          ) : groups.length > 0 ? (
            <HonorableList groups={groups} onOpen={openPick} />
          ) : (
            <Text style={styles.empty}>
              {chip ? 'No honorable mentions match this filter.' : 'No honorable mentions yet.'}
            </Text>
          )}
        </View>
      </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    paddingLeft: 20,
    paddingRight: 12,
  },
  handle: { flex: 1, fontFamily: fontFamily.uiBold, fontSize: 16, color: colors.bone },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 32 },
  error: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  noticeText: { flex: 1, fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.bone },
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
  summaryRow: { paddingHorizontal: 20 },
  summary: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  panel: { gap: 16, paddingHorizontal: 20, paddingTop: 20 },
  empty: {
    paddingTop: 24,
    fontFamily: fontFamily.ui,
    fontSize: 15,
    color: colors.smoke,
    textAlign: 'center',
  },
});
