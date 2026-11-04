import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, getMySaves, unsaveDish } from '@finalmeal/api';
import type { SavedDish } from '@finalmeal/api';
import { filterSaves } from '@finalmeal/core';
import type { SaveFilter } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SavedGrid } from '../../../src/components/SavedGrid';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/providers/SessionProvider';
import { useSavesVersion } from '../../../src/state/save';

const CHIPS: { key: SaveFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'final', label: 'Final Meals' },
  { key: 'honorable', label: 'Honorable' },
  { key: 'nearby', label: 'Nearby' },
];

/** Saved to try: the dishes the person saved from other people's picks, with the Saved board's chips. */
export default function Saved() {
  const router = useRouter();
  const { profile } = useSession();
  const hasHomeCity = (profile?.homeCity ?? null) !== null;
  const [saves, setSaves] = useState<SavedDish[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SaveFilter>('all');
  // Only the newest reload may set the list, so a slow old answer never overwrites a newer one.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const next = await getMySaves(getSupabase());
      if (mine !== latest.current) return;
      setSaves(next);
      setLoadError(null);
    } catch (e) {
      if (mine !== latest.current) return;
      setLoadError(friendlyMessage(e));
    }
  }, []);

  // On every focus, and again when a save changes elsewhere. A refresh keeps what is on screen.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const version = useSavesVersion();
  const seen = useRef(version);
  useEffect(() => {
    if (version === seen.current) return;
    seen.current = version;
    void load();
  }, [version, load]);

  function open(save: SavedDish) {
    if (save.viaPickId) router.push(`/pick/${save.viaPickId}`);
  }

  function confirmRemove(save: SavedDish) {
    Alert.alert('Remove from Saved', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void remove(save) },
    ]);
  }

  async function remove(save: SavedDish) {
    setRemoveError(null);
    setSaves((current) => current?.filter((s) => s.dish.id !== save.dish.id) ?? current);
    try {
      await unsaveDish(getSupabase(), save.dish.id);
    } catch (e) {
      setRemoveError(friendlyMessage(e));
      void load();
    }
  }

  const shown = saves ? filterSaves(saves, filter) : [];
  const needsCity = filter === 'nearby' && !hasHomeCity;

  let body;
  if (saves === null) {
    body = loadError ? (
      <View style={styles.center}>
        <Text style={styles.problem} accessibilityRole="alert">
          {loadError}
        </Text>
        <PrimaryButton label="Try again" onPress={() => void load()} />
      </View>
    ) : (
      <View style={styles.center}>
        <ActivityIndicator testID="saved-loading" color={colors.emberGlow} />
      </View>
    );
  } else if (saves.length === 0) {
    body = (
      <View style={styles.center}>
        <Text style={styles.emptyTitle} accessibilityRole="header">
          Nothing saved yet.
        </Text>
        <Text style={styles.emptyBody}>Tap Save on a dish you want to try and it lands here.</Text>
      </View>
    );
  } else if (needsCity) {
    body = (
      <View style={styles.center}>
        <Text style={styles.emptyBody}>Set your home city to see saves near you.</Text>
        <PrimaryButton
          label="Choose home city"
          variant="secondary"
          onPress={() => router.push('/settings/home-city')}
        />
      </View>
    );
  } else if (shown.length === 0) {
    body = (
      <View style={styles.center}>
        <Text style={styles.emptyBody}>Nothing here with this filter.</Text>
      </View>
    );
  } else {
    body = <SavedGrid saves={shown} onOpen={open} onRemove={confirmRemove} />;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Saved to try
        </Text>
      </View>
      {saves && saves.length > 0 ? (
        <View style={styles.chips}>
          {CHIPS.map(({ key, label }) => {
            const on = filter === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {removeError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {removeError}
        </Text>
      ) : null}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  header: { height: 60, justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontFamily: fontFamily.display, fontSize: 32, color: colors.bone },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.bone, borderColor: colors.bone },
  chipText: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.bone },
  chipTextOn: { color: colors.night },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  problem: { fontFamily: fontFamily.uiMedium, fontSize: 15, color: colors.bone, textAlign: 'center' },
  emptyTitle: { fontFamily: fontFamily.display, fontSize: 28, color: colors.bone, textAlign: 'center' },
  emptyBody: {
    fontFamily: fontFamily.ui,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.smoke,
    textAlign: 'center',
  },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger, paddingHorizontal: 20, paddingBottom: 8 },
});
