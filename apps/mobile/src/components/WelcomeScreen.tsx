import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { WORDMARK_TEXT, colors, typeScale } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { PrimaryButton } from './PrimaryButton';
import { SkullMark } from './SkullMark';
import { WelcomeMap } from './WelcomeMap';

interface WelcomeScreenProps {
  /** Friendly copy shown above the buttons, for example when the profile could not be loaded. */
  notice?: string | null;
  /** Adds a "Try again" button under the notice. */
  onRetry?: () => void;
  retrying?: boolean;
}

function MailIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Rect x={2} y={4} width={20} height={16} rx={2} stroke={colors.white} strokeWidth={1.75} />
      <Path
        d="m22 6-10 7L2 6"
        stroke={colors.white}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The canvas "Welcome" board, map version. Apple and Google sign-in arrive in Phase 8. */
export function WelcomeScreen({ notice, onRetry, retrying = false }: WelcomeScreenProps) {
  const router = useRouter();
  const toEmail = () => router.push('/email');

  return (
    <View style={styles.screen}>
      <ScrollView
        bounces={false}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <WelcomeMap />
          <SafeAreaView edges={['top']} style={styles.brandSlot} pointerEvents="none">
            <View style={styles.brand}>
              <SkullMark size={22} color={colors.ember} />
              <Text style={styles.wordmark}>{WORDMARK_TEXT}</Text>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.copy}>
          <Text style={styles.title} accessibilityRole="header">
            Eat where people would eat their last meal.
          </Text>
          <Text style={styles.subtitle}>
            Every pin is someone’s favourite dish, not a star rating.
          </Text>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.actions}>
          {notice ? (
            <Text style={styles.notice} accessibilityRole="alert">
              {notice}
            </Text>
          ) : null}
          {notice && onRetry ? (
            <PrimaryButton label="Try again" variant="ghost" busy={retrying} onPress={onRetry} />
          ) : null}
          <PrimaryButton label="Continue with email" icon={<MailIcon />} onPress={toEmail} />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Already have an account? Log in"
            onPress={toEmail}
            hitSlop={8}
            style={styles.loginRow}
          >
            <Text style={styles.login}>
              Already have an account? <Text style={styles.loginLink}>Log in</Text>
            </Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  scroll: { flexGrow: 1 },
  brandSlot: { position: 'absolute', top: 0, left: 0, right: 0 },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 20,
    paddingHorizontal: 28,
  },
  wordmark: {
    fontFamily: fontFamily.wordmark,
    fontSize: 25,
    lineHeight: 25,
    letterSpacing: typeScale.wordmark.letterSpacingEm * 25,
    color: colors.bone,
  },
  copy: { flex: 1, gap: 12, paddingTop: 22, paddingHorizontal: 28, paddingBottom: 20 },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 36,
    lineHeight: 36 * 1.1,
    letterSpacing: -0.01 * 36,
    color: colors.bone,
  },
  subtitle: {
    fontFamily: fontFamily.ui,
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.size * typeScale.body.lineHeight,
    color: colors.smoke,
  },
  actions: { gap: 12, paddingHorizontal: 24, paddingBottom: 8 },
  notice: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 14,
    lineHeight: 14 * 1.4,
    color: colors.danger,
    textAlign: 'center',
  },
  loginRow: { alignItems: 'center', paddingVertical: 4 },
  login: { fontFamily: fontFamily.ui, fontSize: 14, color: colors.smoke },
  loginLink: { fontFamily: fontFamily.uiBold, color: colors.bone },
});
