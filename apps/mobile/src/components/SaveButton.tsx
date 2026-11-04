import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

interface SaveButtonProps {
  saved: boolean;
  /** A call is in flight; the button keeps its label and a screen reader hears it is busy. */
  busy?: boolean;
  onPress: () => void;
}

/** `Save to try` (ember, bookmark); once saved, `Saved` (outlined, filled bookmark). Tapping again unsaves. */
export function SaveButton({ saved, busy = false, onPress }: SaveButtonProps) {
  const label = saved ? 'Saved' : 'Save to try';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      onPress={onPress}
      style={({ pressed }) => [styles.button, saved ? styles.saved : styles.primary, pressed && styles.pressed]}
    >
      <Icon
        name="bookmark"
        size={18}
        color={saved ? colors.emberGlow : colors.white}
        fill={saved ? colors.emberGlow : 'none'}
      />
      <Text style={[styles.label, saved && styles.labelSaved]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
  },
  primary: { backgroundColor: colors.ember },
  saved: { borderWidth: 1, borderColor: colors.lineStrong },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fontFamily.uiBold, fontSize: 14, letterSpacing: 0.01 * 14, color: colors.white },
  labelSaved: { color: colors.bone },
});
