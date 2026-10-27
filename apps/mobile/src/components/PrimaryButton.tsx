import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the label and ignores presses. */
  busy?: boolean;
  /** `ghost` is the outlined button; `secondary` is the raised-ash button used beside a primary. */
  variant?: 'primary' | 'ghost' | 'secondary';
  icon?: ReactNode;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'primary',
  icon,
  testID,
}: PrimaryButtonProps) {
  const inactive = disabled || busy;
  const labelColor = variant === 'primary' ? colors.white : colors.bone;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle[variant],
        disabled && !busy && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator testID="cta-busy" color={labelColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.ember },
  ghost: { borderWidth: 1, borderColor: colors.lineStrong },
  secondary: { backgroundColor: colors.ashRaised },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    fontFamily: fontFamily.uiBold,
    fontSize: 15,
    letterSpacing: 0.01 * 15,
  },
});

const variantStyle = {
  primary: styles.primary,
  ghost: styles.ghost,
  secondary: styles.secondary,
} as const;
