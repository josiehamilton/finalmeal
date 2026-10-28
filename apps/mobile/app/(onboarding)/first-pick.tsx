import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { finishOnboarding, friendlyMessage } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SkullMark } from '../../src/components/SkullMark';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { useBlockBack } from '../../src/lib/use-block-back';

const SEATS = [1, 2, 3, 4, 5] as const;

/**
 * "The hard part": the step after the photo. Add my first pick opens the form (onboarding is
 * finished there, once the pick is saved); Skip for now finishes it right here.
 */
export default function FirstPick() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The profile exists by now, so there is no way back to the earlier steps.
  useBlockBack();

  async function skip() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await finishOnboarding(getSupabase());
      router.replace('/loading');
    } catch (e) {
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <SkullMark size={64} color={colors.ember} />
        <Text style={styles.title} accessibilityRole="header">
          Now for the hard part.
        </Text>
        <Text style={styles.body}>Five dishes. Forever. What’s the first one on your Final Meal?</Text>
        <View
          style={styles.seats}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {SEATS.map((n) => (
            <View
              key={n}
              testID={`seat-tile-${n}`}
              style={[styles.seat, n === 1 ? styles.seatOn : styles.seatOff]}
            >
              <Text style={[styles.seatNumber, n === 1 && styles.seatNumberOn]}>{n}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.bottom}>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <PrimaryButton
          label="Add my first pick"
          icon={<SkullMark size={16} color={colors.white} />}
          disabled={busy}
          onPress={() => router.push('/add-first')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void skip()}
          style={styles.skip}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  center: { flex: 1, justifyContent: 'center', gap: 22, paddingHorizontal: 32 },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 44,
    lineHeight: 44 * 1.08,
    letterSpacing: -0.01 * 44,
    color: colors.bone,
  },
  body: { fontFamily: fontFamily.ui, fontSize: 17, lineHeight: 17 * 1.5, color: colors.smoke },
  seats: { flexDirection: 'row', gap: 10, paddingTop: 8 },
  seat: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatOn: { borderStyle: 'solid', borderColor: colors.emberGlow },
  seatOff: { borderStyle: 'dashed', borderColor: colors.lineStrong },
  seatNumber: { fontFamily: fontFamily.serifItalic, fontSize: 20, color: colors.dim },
  seatNumberOn: { color: colors.emberGlow },
  bottom: { gap: 6, paddingHorizontal: 24, paddingBottom: 8 },
  error: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
    paddingBottom: 6,
  },
  skip: { alignSelf: 'center', padding: 12 },
  skipText: { fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
});
