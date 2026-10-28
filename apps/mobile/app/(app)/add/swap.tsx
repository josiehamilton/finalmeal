import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, getMyPicks, promotePick } from '@finalmeal/api';
import type { Pick } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { Icon } from '../../../src/components/Icon';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { SlotRow } from '../../../src/components/SlotRow';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useBlockBack } from '../../../src/lib/use-block-back';
import { useAddDish } from '../../../src/state/add-dish';
import { announcePicksChanged } from '../../../src/state/pick-changes';
import { useSavePick } from '../../../src/state/save-pick';

interface Incoming {
  name: string;
  where: string;
  photo: string | null;
}

/**
 * Swap: the five are full, so choose the Final Meal dish the new one replaces (it moves to the
 * Honorable mentions, nothing is deleted). The new one is the Add-a-dish draft, or, with a
 * `promote` param, an honorable pick being made a Final Meal.
 */
export default function Swap() {
  const router = useRouter();
  const { promote } = useLocalSearchParams<{ promote?: string }>();
  const { draft } = useAddDish();
  const { busy: saving, save } = useSavePick();
  const [promoting, setPromoting] = useState(false);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || promoting;
  useBlockBack(busy);

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

  const finals = (picks ?? []).filter((p) => p.tier === 'final');
  const promoted = promote ? (picks ?? []).find((p) => p.id === promote) : undefined;
  const incoming: Incoming | null = promote
    ? promoted
      ? { name: promoted.dish.name, where: promoted.place.label, photo: promoted.photoUrl }
      : null
    : draft.place && draft.dishName.trim() !== ''
      ? { name: draft.dishName.trim(), where: draft.place.label, photo: draft.photoUri }
      : null;
  const chosen = finals.find((p) => p.slot === slot) ?? null;

  async function replace() {
    if (!chosen || busy || slot === null) return;
    setError(null);
    if (promote) {
      setPromoting(true);
      try {
        await promotePick(getSupabase(), promote, slot);
        announcePicksChanged();
        router.dismissTo('/(app)/you');
      } catch (e) {
        setError(friendlyMessage(e));
        setPromoting(false);
      }
      return;
    }
    const outcome = await save(draft, slot);
    if (!outcome) return;
    if (outcome.status === 'saved') {
      announcePicksChanged({ photoFailed: outcome.photoFailed });
      router.dismissTo('/(app)/you');
    } else {
      setError(friendlyMessage(outcome.error));
    }
  }

  const problem = loadError ?? (picks && !incoming ? friendlyMessage(null) : null);
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Your five are full" onBack={() => router.back()} backDisabled={busy} />
      {picks === null && !loadError ? (
        <View style={styles.center}>
          <ActivityIndicator testID="swap-loading" color={colors.emberGlow} />
        </View>
      ) : problem ? (
        <View style={styles.center}>
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
          {loadError ? <PrimaryButton label="Try again" onPress={() => void load()} /> : null}
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title} accessibilityRole="header">
              Something has to go.
            </Text>
            {incoming ? (
              <View style={styles.incoming}>
                <View style={styles.thumb}>
                  {incoming.photo ? (
                    <Image source={{ uri: incoming.photo }} style={styles.thumbImage} />
                  ) : (
                    <Icon name="image" size={16} color={colors.dim} />
                  )}
                </View>
                <View style={styles.incomingText}>
                  <Text style={styles.incomingDish} numberOfLines={1}>
                    {incoming.name}
                  </Text>
                  <Text style={styles.incomingWhere} numberOfLines={1}>
                    {incoming.where}
                  </Text>
                </View>
                <Text style={styles.incomingTag}>Incoming</Text>
              </View>
            ) : null}
            <Text style={styles.help}>
              Pick the dish it replaces. That one moves to your Honorable Mentions — nothing is
              deleted.
            </Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Dish to replace" style={styles.rows}>
              {finals.map((pick) => (
                <SlotRow
                  key={pick.id}
                  pick={pick}
                  selectable
                  selected={pick.slot === slot}
                  onPress={() => setSlot(pick.slot)}
                />
              ))}
            </View>
          </ScrollView>
          <View style={styles.bottom}>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            <PrimaryButton
              label={chosen ? `Replace ${chosen.dish.name}` : 'Choose one to replace'}
              onPress={() => void replace()}
              disabled={!chosen}
              busy={busy}
              icon={<Icon name="swap" size={18} color={colors.white} />}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
              onPress={() => router.back()}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  problem: { fontFamily: fontFamily.uiMedium, fontSize: 15, color: colors.bone, textAlign: 'center' },
  content: { gap: 18, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 34 * 1.1, color: colors.bone },
  incoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.emberGlow,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: 44, height: 44 },
  incomingText: { flex: 1, gap: 2, minWidth: 0 },
  incomingDish: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  incomingWhere: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  incomingTag: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    textTransform: 'uppercase',
    color: colors.emberGlow,
  },
  help: { fontFamily: fontFamily.ui, fontSize: 14, lineHeight: 14 * 1.5, color: colors.smoke },
  rows: { gap: 8 },
  bottom: { gap: 4, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger, paddingBottom: 8 },
  cancel: { alignSelf: 'center', padding: 12 },
  cancelText: { fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
});
