import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { friendlyMessage, setMyHomeCity } from '@finalmeal/api';
import type { City } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { CityPicker } from '../../src/components/CityPicker';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { useBlockBack } from '../../src/lib/use-block-back';

/** Step 5. The profile exists by now, so there is no way back from here. */
export default function CityStep() {
  const router = useRouter();
  const [city, setCity] = useState<City | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBlockBack();

  async function next() {
    if (!city) return;
    setBusy(true);
    setError(null);
    try {
      await setMyHomeCity(getSupabase(), city.id);
      router.push('/photo');
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingScreen
      step={5}
      title="What’s your home city?"
      subtitle="We’ll show you the best picks nearby. You can change it anytime."
      onSkip={() => router.push('/photo')}
      cta={{ label: 'Continue', onPress: next, disabled: city === null, busy }}
    >
      <CityPicker
        allowCurrentLocation
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
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
