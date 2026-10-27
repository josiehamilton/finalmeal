import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { PrimaryButton } from './PrimaryButton';

const STEPS = [1, 2, 3, 4, 5, 6] as const;

export interface OnboardingScreenProps {
  /** 1 to 6; leave out for screens outside the numbered flow. */
  step?: (typeof STEPS)[number];
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  children: ReactNode;
  cta: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean };
  /** Small print under the button. */
  footer?: ReactNode;
}

export function OnboardingScreen({
  step,
  title,
  subtitle,
  onBack,
  onSkip,
  children,
  cta,
  footer,
}: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <View style={styles.side}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onBack}
                hitSlop={8}
                style={styles.back}
              >
                <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="m15 18-6-6 6-6"
                    stroke={colors.bone}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            ) : null}
          </View>
          {step ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel="Sign-up progress"
              accessibilityValue={{ min: 1, max: STEPS.length, now: step }}
              style={styles.progress}
            >
              {STEPS.map((n) => (
                <View
                  key={n}
                  testID={`progress-${n}`}
                  style={[
                    styles.segment,
                    { backgroundColor: n <= step ? colors.ember : colors.lineStrong },
                  ]}
                />
              ))}
            </View>
          ) : (
            <View style={styles.flex} />
          )}
          <View style={styles.skipSlot}>
            {onSkip ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip"
                onPress={onSkip}
                hitSlop={12}
              >
                <Text style={styles.skip}>Skip</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heading}>
            {step ? (
              <Text style={styles.stepLabel}>{`Step ${step} of ${STEPS.length}`}</Text>
            ) : null}
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </ScrollView>

        <View style={styles.bottom}>
          <PrimaryButton {...cta} />
          {footer}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingRight: 20,
    paddingLeft: 6,
  },
  side: { width: 44, height: 44 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  skipSlot: { width: 44, alignItems: 'flex-end' },
  skip: { fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
  content: { gap: 28, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  heading: { gap: 12 },
  stepLabel: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 34,
    lineHeight: 34 * 1.12,
    letterSpacing: -0.01 * 34,
    color: colors.bone,
  },
  subtitle: {
    fontFamily: fontFamily.ui,
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.size * typeScale.body.lineHeight,
    color: colors.smoke,
  },
  bottom: { gap: 14, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
});
