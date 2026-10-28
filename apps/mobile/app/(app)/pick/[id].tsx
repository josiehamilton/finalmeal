import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ApiError,
  demotePick,
  friendlyMessage,
  getMyPicks,
  moveFinal,
  promotePick,
  removePick,
} from '@finalmeal/api';
import type { Pick } from '@finalmeal/api';
import { FINAL_MEAL_SIZE } from '@finalmeal/core';
import { colors, radii } from '@finalmeal/ui-tokens';
import { Icon } from '../../../src/components/Icon';
import { PickActions } from '../../../src/components/PickActions';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { SkullMark } from '../../../src/components/SkullMark';
import { TagChips } from '../../../src/components/TagChips';
import { openDirections } from '../../../src/lib/directions';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { announcePicksChanged, getPicksVersion, usePicksVersion } from '../../../src/state/pick-changes';

const HERO_HEIGHT = 400;

/** Swaps in the updated pick; when a final leaves the Final Meal, the ones after it move up a slot. */
function applyUpdated(picks: Pick[], updated: Pick): Pick[] {
  const before = picks.find((p) => p.id === updated.id);
  return picks.map((p) => {
    if (p.id === updated.id) return updated;
    if (before?.tier === 'final' && updated.tier === 'honorable' && p.slot !== null && before.slot !== null && p.slot > before.slot) {
      return { ...p, slot: p.slot - 1 };
    }
    return p;
  });
}

/** One of your own picks. (Viewing other people's picks arrives in Phase 4.) */
export default function PickDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setPicks(await getMyPicks(getSupabase()));
    } catch (e) {
      setLoadError(friendlyMessage(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Reload when picks change elsewhere (a saved edit); changes made here are applied in place.
  const version = usePicksVersion();
  const seen = useRef(version);
  useEffect(() => {
    if (version === seen.current) return;
    seen.current = version;
    void load();
  }, [version, load]);
  function announce() {
    announcePicksChanged();
    seen.current = getPicksVersion();
  }

  const pick = picks?.find((p) => p.id === id) ?? null;
  const finalCount = (picks ?? []).filter((p) => p.tier === 'final').length;

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function goToSwap(pickId: string) {
    router.push({ pathname: '/add/swap', params: { promote: pickId } });
  }

  function promote(target: Pick) {
    if (finalCount >= FINAL_MEAL_SIZE) {
      goToSwap(target.id);
      return;
    }
    void run(async () => {
      try {
        const updated = await promotePick(getSupabase(), target.id);
        setPicks((current) => (current ? applyUpdated(current, updated) : current));
        announce();
      } catch (e) {
        if (e instanceof ApiError && e.code === 'final_full') {
          goToSwap(target.id);
          return;
        }
        throw e;
      }
    });
  }

  function demote(target: Pick) {
    void run(async () => {
      const updated = await demotePick(getSupabase(), target.id);
      setPicks((current) => (current ? applyUpdated(current, updated) : current));
      announce();
    });
  }

  function move(target: Pick, direction: 'up' | 'down') {
    if (target.slot === null) return;
    void run(async () => {
      setPicks(await moveFinal(getSupabase(), target.id, target.slot! + (direction === 'up' ? -1 : 1)));
      announce();
    });
  }

  function remove(target: Pick) {
    void run(async () => {
      await removePick(getSupabase(), target.id);
      announce();
      router.back();
    });
  }

  function directions(target: Pick) {
    setActionError(null);
    openDirections(target.place).catch(() => setActionError(friendlyMessage(null)));
  }

  if (!pick) {
    const problem =
      loadError ?? (picks ? friendlyMessage(new ApiError('Pick not found', 'pick_not_found')) : null);
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="" onBack={() => router.back()} />
        <View style={styles.center}>
          {problem ? (
            <>
              <Text style={styles.problem} accessibilityRole="alert">
                {problem}
              </Text>
              {loadError ? <PrimaryButton label="Try again" onPress={() => void load()} /> : null}
            </>
          ) : (
            <ActivityIndicator testID="pick-loading" color={colors.emberGlow} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const isFinal = pick.tier === 'final' && pick.slot !== null;
  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View>
          {pick.photoUrl ? (
            <Image
              testID="hero-photo"
              source={{ uri: pick.photoUrl }}
              accessibilityLabel={`Photo of ${pick.dish.name}`}
              resizeMode="cover"
              style={styles.hero}
            />
          ) : (
            <View testID="hero-placeholder" style={[styles.hero, styles.placeholder]}>
              <SkullMark size={72} color={colors.ember} />
            </View>
          )}
          <View style={styles.badgeWrap}>
            <View style={[styles.badge, !isFinal && styles.badgeHonorable]}>
              {isFinal ? <SkullMark size={12} color={colors.white} /> : null}
              <Text style={[styles.badgeText, !isFinal && styles.badgeTextHonorable]}>
                {isFinal ? `Final Meal · #${pick.slot}` : 'Honorable'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.head}>
            <Text style={styles.dish} accessibilityRole="header">
              {pick.dish.name}
            </Text>
            <View style={styles.where}>
              <Icon name="pin" size={16} color={colors.smoke} />
              <Text style={styles.whereText}>{pick.place.label}</Text>
            </View>
            <TagChips tags={pick.tags} />
          </View>

          <PrimaryButton
            label="Directions"
            variant="ghost"
            onPress={() => directions(pick)}
            icon={<Icon name="directions" size={18} color={colors.bone} />}
          />

          {pick.note ? (
            <View testID="pick-note" style={styles.note}>
              <Text style={styles.noteText}>{`“${pick.note}”`}</Text>
            </View>
          ) : null}

          {actionError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {actionError}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.bar}>
        <View pointerEvents="box-none" style={styles.barRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.circle}
          >
            <Icon name="back" size={21} color={colors.bone} />
          </Pressable>
          <PickActions
            pick={pick}
            finalCount={finalCount}
            disabled={busy}
            onEdit={() => router.push(`/pick/${pick.id}/edit`)}
            onPromote={() => promote(pick)}
            onDemote={() => demote(pick)}
            onMove={(direction) => move(pick, direction)}
            onRemove={() => remove(pick)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  problem: { fontFamily: fontFamily.uiMedium, fontSize: 15, color: colors.bone, textAlign: 'center' },
  scroll: { paddingBottom: 40 },
  hero: { width: '100%', height: HERO_HEIGHT },
  placeholder: { backgroundColor: colors.ashRaised, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: { position: 'absolute', left: 20, bottom: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.ember,
  },
  badgeHonorable: { backgroundColor: colors.ashRaised },
  badgeText: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    color: colors.white,
  },
  badgeTextHonorable: { color: colors.honorable },
  body: { gap: 18, paddingHorizontal: 20, paddingTop: 20 },
  head: { gap: 6 },
  dish: {
    fontFamily: fontFamily.serif,
    fontSize: 40,
    lineHeight: 40 * 1.05,
    letterSpacing: -0.01 * 40,
    color: colors.bone,
  },
  where: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whereText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 15, color: colors.smoke },
  note: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteText: {
    fontFamily: fontFamily.serifItalic,
    fontSize: 19,
    lineHeight: 19 * 1.4,
    color: colors.honorable,
  },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
