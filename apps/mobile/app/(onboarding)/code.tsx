import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { friendlyCode, friendlyMessage, sendEmailCode, verifyEmailCode } from '@finalmeal/api';
import { normalizeEmail } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { CODE_LENGTH, CodeInput } from '../../src/components/CodeInput';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { fontFamily } from '../../src/lib/fonts';
import { routeFor } from '../../src/lib/route-for';
import { getSupabase } from '../../src/lib/supabase';
import { useSession } from '../../src/providers/SessionProvider';

const RESEND_SECONDS = 30;

function MailIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Rect x={2} y={4} width={20} height={16} rx={2} stroke={colors.bone} strokeWidth={1.75} />
      <Path
        d="m22 6-10 7L2 6"
        stroke={colors.bone}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function countdownLabel(seconds: number): string {
  return `Resend in 0:${String(seconds).padStart(2, '0')}`;
}

/** Step 2. */
export default function CodeStep() {
  const router = useRouter();
  const { refreshProfile } = useSession();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = normalizeEmail(params.email ?? '');

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  // Once the code has been accepted it is spent; a retry after a profile-load failure must not use it again.
  const verified = useRef(false);

  // The countdown is independent of everything else, so errors never reset it.
  const counting = secondsLeft > 0;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [counting]);

  async function verify(entered: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!verified.current) {
        await verifyEmailCode(getSupabase(), email, entered);
        verified.current = true;
      }
    } catch (e) {
      setError(friendlyMessage(e));
      setCode('');
      setBusy(false);
      return;
    }
    try {
      const profile = await refreshProfile();
      router.replace(routeFor({ session: true, profile, loading: false }) ?? '/welcome');
    } catch (e) {
      // Signed in, but the profile could not be read. Verify retries just the read.
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  async function resend() {
    if (resending || counting) return;
    setResending(true);
    setError(null);
    try {
      await sendEmailCode(getSupabase(), email);
      setCode('');
      verified.current = false;
      setSecondsLeft(RESEND_SECONDS);
    } catch (e) {
      setError(friendlyMessage(e));
      if (friendlyCode(e) === 'rate_limited') setSecondsLeft(RESEND_SECONDS);
    } finally {
      setResending(false);
    }
  }

  const ready = code.length === CODE_LENGTH || verified.current;

  return (
    <OnboardingScreen
      step={2}
      title="Check your email."
      subtitle={`Enter the 6-digit code we sent to ${email}.`}
      onBack={() => router.back()}
      cta={{ label: 'Verify', onPress: () => verify(code), disabled: !ready, busy }}
    >
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (error) setError(null);
        }}
        onComplete={verify}
        hasError={error !== null}
        disabled={busy}
        autoFocus
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={styles.row}>
        {counting ? (
          <Text style={styles.countdown}>{countdownLabel(secondsLeft)}</Text>
        ) : (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Resend code"
            onPress={resend}
            disabled={resending}
            hitSlop={8}
          >
            <Text style={styles.link}>Resend code</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Change email"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={styles.link}>Change email</Text>
        </Pressable>
      </View>
      {Platform.OS === 'ios' ? (
        <PrimaryButton
          label="Open mail app"
          variant="secondary"
          icon={<MailIcon />}
          onPress={() => {
            Linking.openURL('message:').catch(() => {});
          }}
        />
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -10 },
  countdown: { fontFamily: fontFamily.ui, fontSize: 14, color: colors.dim },
  link: { fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
  error: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    lineHeight: 13 * 1.4,
    color: colors.danger,
    marginTop: -14,
  },
});
