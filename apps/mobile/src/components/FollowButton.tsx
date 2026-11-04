import { Pressable, StyleSheet, Text } from 'react-native';
import type { FollowState } from '@finalmeal/api';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { PrimaryButton } from './PrimaryButton';

interface FollowButtonProps {
  state: FollowState;
  /** They follow you, so a plain Follow reads "Follow back". */
  followsViewer: boolean;
  onPress: () => void;
  /** A call is in flight; the button keeps its label and a screen reader hears it is busy. */
  busy?: boolean;
  /** Yourself: there is nothing to follow. */
  isMe?: boolean;
  /** `full` is the profile's 40-point button; `row` is the 36-point pill in a people list. */
  size?: 'full' | 'row';
}

export function followLabel(state: FollowState, followsViewer: boolean): string {
  if (state === 'active') return 'Following';
  if (state === 'requested') return 'Requested';
  return followsViewer ? 'Follow back' : 'Follow';
}

/** Follow / Follow back (ember), Requested and Following (outlined). Not shown for yourself. */
export function FollowButton({
  state,
  followsViewer,
  onPress,
  busy = false,
  isMe = false,
  size = 'full',
}: FollowButtonProps) {
  if (isMe) return null;
  const label = followLabel(state, followsViewer);
  const filled = state === 'none';
  if (size === 'full') {
    return (
      <PrimaryButton
        label={label}
        variant={filled ? 'primary' : 'ghost'}
        size="compact"
        onPress={onPress}
      />
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        filled ? styles.filled : styles.outline,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: filled ? colors.white : colors.bone }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: colors.ember },
  outline: { borderWidth: 1, borderColor: colors.lineStrong },
  pressed: { opacity: 0.85 },
  label: { fontFamily: fontFamily.uiBold, fontSize: 13 },
});
