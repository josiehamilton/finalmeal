import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, updateMyProfile } from '@finalmeal/api';
import type { ProfilePatch } from '@finalmeal/api';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { VisibilityCards } from '../../../src/components/VisibilityCards';
import type { Visibility } from '../../../src/components/VisibilityCards';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/providers/SessionProvider';

export default function Privacy() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  // Optimistic: these change the moment you tap, and roll back if the save fails.
  const [visibility, setVisibility] = useState<Visibility>(profile?.visibility ?? 'public');
  const [showHomeCity, setShowHomeCity] = useState(profile?.showHomeCity ?? true);
  const [error, setError] = useState<string | null>(null);
  // One save at a time, so a rollback can never undo a newer choice.
  const saving = useRef(false);

  async function save(patch: ProfilePatch, rollback: () => void) {
    if (saving.current) return;
    saving.current = true;
    setError(null);
    try {
      await updateMyProfile(getSupabase(), patch);
    } catch (e) {
      rollback();
      setError(friendlyMessage(e));
      saving.current = false;
      return;
    }
    try {
      await refreshProfile();
    } catch {
      // The change is saved; only the shared copy is stale, and the session reports why.
    }
    saving.current = false;
  }

  function chooseVisibility(next: Visibility) {
    if (next === visibility || saving.current) return;
    const before = visibility;
    setVisibility(next);
    void save({ visibility: next }, () => setVisibility(before));
  }

  function toggleHomeCity(next: boolean) {
    if (saving.current) return;
    const before = showHomeCity;
    setShowHomeCity(next);
    void save({ showHomeCity: next }, () => setShowHomeCity(before));
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <ScreenHeader title="Privacy & safety" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Profile visibility</Text>
          <VisibilityCards value={visibility} onChange={chooseVisibility} />
          <Text style={styles.helper}>Everyone starts public.</Text>
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Show my home city</Text>
            <Text style={styles.toggleSub}>Shown on your profile.</Text>
          </View>
          <Switch
            accessibilityLabel="Show my home city"
            value={showHomeCity}
            onValueChange={toggleHomeCity}
            trackColor={{ true: colors.ember, false: colors.lineStrong }}
            thumbColor={colors.white}
          />
        </View>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  content: { gap: 16, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  helper: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.dim },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  toggleText: { flex: 1, gap: 3 },
  toggleLabel: { fontFamily: fontFamily.uiSemiBold, fontSize: 15, color: colors.bone },
  toggleSub: { fontFamily: fontFamily.ui, fontSize: 13, lineHeight: 13 * 1.4, color: colors.smoke },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
