import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  ApiError,
  createMyProfile,
  friendlyCode,
  friendlyMessage,
  isUsernameAvailable,
} from '@finalmeal/api';
import { isValidUsername } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { TextField } from '../../src/components/TextField';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { suggestUsername } from '../../src/onboarding/suggest-username';

const DEBOUNCE_MS = 400;

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'failed';

const copy = (code: 'username_taken' | 'invalid_username') =>
  friendlyMessage(new ApiError(code, code));

function AvailableBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Available">
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessible={false}>
        <Path
          d="M20 6 9 17l-5-5"
          stroke={colors.honorable}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={styles.badgeText}>Available</Text>
    </View>
  );
}

/** Step 4. Creating the profile happens here, with the name from step 3. */
export default function UsernameStep() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const displayName = params.name ?? '';

  const [username, setUsername] = useState(() => suggestUsername(displayName));
  const [status, setStatus] = useState<Availability>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const request = ++latest.current;
    setMessage(null);
    if (username === '') {
      setStatus('idle');
      return;
    }
    if (!isValidUsername(username)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const free = await isUsernameAvailable(getSupabase(), username);
        if (request === latest.current) setStatus(free ? 'available' : 'taken');
      } catch (e) {
        if (request !== latest.current) return;
        setStatus('failed');
        setMessage(friendlyMessage(e));
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [username]);

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
        latest.current++;
        setStatus('taken');
      } else if (code === 'invalid_username') {
        latest.current++;
        setStatus('invalid');
      } else {
        setMessage(friendlyMessage(e));
      }
      setBusy(false);
    }
  }

  const error =
    status === 'taken'
      ? copy('username_taken')
      : status === 'invalid'
        ? copy('invalid_username')
        : message;

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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.honorable },
  helper: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.dim, marginTop: -18 },
});
