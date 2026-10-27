import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text } from 'react-native';
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
  // State is stale within one tick, so a double "return" needs a ref to be caught.
  const sending = useRef(false);

  async function send() {
    if (sending.current) return;
    const normalised = normalizeEmail(email);
    if (!isPlausibleEmail(normalised)) {
      setError(friendlyMessage(new ApiError('Invalid email address', 'invalid_email')));
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await sendEmailCode(getSupabase(), normalised);
      router.push(`/code?email=${encodeURIComponent(normalised)}`);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  // Resumed after a relaunch and sent back here, there is nothing behind this screen; Back then goes to Welcome.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/welcome');
  }, [router]);

  // The Android back button does the same, instead of leaving the app from a sign-up step.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (router.canGoBack()) return false; // the stack handles it
        goBack();
        return true;
      });
      return () => subscription.remove();
    }, [router, goBack]),
  );

  return (
    <OnboardingScreen
      step={1}
      title="What’s your email?"
      subtitle="We’ll send a code to sign you in. No passwords to remember."
      onBack={goBack}
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
