import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { createMyProfile, friendlyCode, friendlyMessage } from '@finalmeal/api';
import { isValidUsername } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { AvailableBadge } from '../../src/components/AvailableBadge';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { TextField } from '../../src/components/TextField';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { useUsernameAvailability } from '../../src/lib/use-username-availability';
import { suggestUsername } from '../../src/onboarding/suggest-username';

/** Step 4. Creating the profile happens here, with the name from step 3. */
export default function UsernameStep() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const displayName = params.name ?? '';

  const [username, setUsername] = useState(() => suggestUsername(displayName));
  const { status, error, setMessage, reject } = useUsernameAvailability(username);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      await createMyProfile(getSupabase(), { displayName, username });
      router.replace('/city');
    } catch (e) {
      const code = friendlyCode(e);
      if (code === 'profile_exists') {
        // A retry after a dropped connection: the profile is already there.
        router.replace('/city');
        return;
      }
      if (code === 'username_taken') {
        reject('taken');
      } else if (code === 'invalid_username') {
        reject('invalid');
      } else {
        setMessage(friendlyMessage(e));
      }
      setBusy(false);
    }
  }

  return (
    <OnboardingScreen
      step={4}
      title="Claim your handle."
      subtitle="This is how friends find your Final Meal."
      onBack={() => router.back()}
      cta={{
        label: 'Continue',
        onPress: submit,
        busy,
        disabled: !isValidUsername(username) || status === 'taken',
      }}
    >
      <TextField
        label="Username"
        prefix="@"
        value={username}
        onChangeText={(text) => setUsername(text.replace(/^@+/, ''))}
        error={error}
        suffix={status === 'available' ? <AvailableBadge /> : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        returnKeyType="done"
        autoFocus
      />
      <Text style={styles.helper}>Letters, numbers and underscores. You can change it later.</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  helper: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.dim, marginTop: -18 },
});
