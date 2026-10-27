import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { friendlyMessage, setMyHomeCity } from '@finalmeal/api';
import type { City } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { CityPicker } from '../../../src/components/CityPicker';
import { OnboardingScreen } from '../../../src/components/OnboardingScreen';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/providers/SessionProvider';

export default function HomeCity() {
  const router = useRouter();
  const { profile, refreshProfile } = useSession();
  const [city, setCity] = useState<Pick<City, 'id' | 'label'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(id: string | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setMyHomeCity(getSupabase(), id);
      try {
        await refreshProfile();
      } catch {
        // The change is saved. Only the shared copy is stale; the You tab shows the reason and a retry.
      }
      router.back();
    } catch (e) {
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <OnboardingScreen
      title="Home city"
      subtitle="We’ll show you the best picks nearby."
      onBack={() => router.back()}
      cta={{
        label: 'Save',
        onPress: () => change(city?.id ?? null),
        disabled: city === null,
        busy,
      }}
      footer={
        profile?.homeCity ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear home city"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => change(null)}
            hitSlop={8}
            style={styles.clear}
          >
            <Text style={styles.clearText}>Clear home city</Text>
          </Pressable>
        ) : undefined
      }
    >
      <CityPicker
        onChange={(next) => {
          setCity(next);
          setError(null);
        }}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  clear: { alignSelf: 'center', paddingVertical: 8 },
  clearText: { fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
