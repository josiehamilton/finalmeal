import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

export const CODE_LENGTH = 6;

interface CodeInputProps {
  /** Called once, as soon as all six digits are in. */
  onComplete: (code: string) => void;
  onChange?: (code: string) => void;
  /** Controlled value; leave out to let the input keep its own. To clear, pass '' or remount with a new key. */
  value?: string;
  hasError?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Six digit boxes over one invisible input, so pasting and the OS "code from Messages / Mail"
 * suggestion fill every box at once.
 */
export function CodeInput({
  onComplete,
  onChange,
  value,
  hasError = false,
  disabled = false,
  autoFocus = false,
}: CodeInputProps) {
  const [inner, setInner] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const code = value ?? inner;

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setInner(digits);
    onChange?.(digits);
    if (digits.length === CODE_LENGTH && code.length !== CODE_LENGTH) onComplete(digits);
  }

  const active = Math.min(code.length, CODE_LENGTH - 1);
  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessible={false}
      style={styles.row}
      disabled={disabled}
    >
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <View
          key={i}
          style={[
            styles.box,
            focused && i === active && styles.boxActive,
            hasError && styles.boxError,
          ]}
        >
          <Text testID={`code-box-${i}`} style={styles.digit}>
            {code[i] ?? ''}
          </Text>
        </View>
      ))}
      <TextInput
        ref={inputRef}
        testID="code-input"
        accessibilityLabel="Verification code"
        value={code}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH * 2}
        caretHidden
        selectionColor="transparent"
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 60,
    borderRadius: radii.input,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.emberGlow },
  boxError: { borderColor: colors.danger },
  digit: { fontFamily: fontFamily.uiBold, fontSize: 24, color: colors.bone },
  // Covers the boxes, fully transparent, so a tap focuses it and the OS can offer the code.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.015,
    color: 'transparent',
  },
});
