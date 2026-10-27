import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ApiError, friendlyMessage, sendEmailCode } from '@finalmeal/api';
import { isPlausibleEmail, normalizeEmail } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { TextField } from '../../src/components/TextField';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';

/** Step 1. */
export default function EmailStep() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    const normalised = normalizeEmail(email);
    if (!isPlausibleEmail(normalised)) {
      setError(friendlyMessage(new ApiError('Invalid email address', 'invalid_email')));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendEmailCode(getSupabase(), normalised);
      router.push(`/code?email=${encodeURIComponent(normalised)}`);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingScreen
      step={1}
      title="What’s your email?"
      subtitle="We’ll send a code to sign you in. No passwords to remember."
      onBack={() => router.back()}
      cta={{ label: 'Send code', onPress: send, busy }}
      footer={<Text style={styles.footer}>We never share your email.</Text>}
    >
      <TextField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError(null);
        }}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={send}
        autoFocus
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  footer: {
    fontFamily: fontFamily.ui,
    fontSize: 13,
    color: colors.dim,
    textAlign: 'center',
  },
});
