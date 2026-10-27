import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors, radii, typeScale } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Friendly error copy, shown under the field. */
  error?: string | null;
  /** Fixed text before the input, such as "@". */
  prefix?: string;
  /** Anything after the input, such as an "Available" indicator. */
  suffix?: ReactNode;
}

export function TextField({
  label,
  error,
  prefix,
  suffix,
  onFocus,
  onBlur,
  ...input
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.dim}
          selectionColor={colors.emberGlow}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
        />
        {suffix}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: radii.input,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  boxFocused: { borderColor: colors.emberGlow },
  boxError: { borderColor: colors.danger },
  prefix: { fontFamily: fontFamily.uiMedium, fontSize: 17, color: colors.smoke },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    padding: 0,
    fontFamily: fontFamily.uiMedium,
    fontSize: 17,
    color: colors.bone,
  },
  error: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    lineHeight: 13 * 1.4,
    color: colors.danger,
  },
});
