import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

interface AvatarProps {
  /** A photo, or null to show initials. */
  uri: string | null;
  /** The display name, for the initials and the accessibility label. */
  name: string;
  size: number;
  accessibilityLabel?: string;
}

/** The first letters of the first two words of a name, upper-case ("Josie Hamilton" → "JH"). */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '');
  return letters.join('').toUpperCase();
}

export function Avatar({ uri, name, size, accessibilityLabel }: AvatarProps) {
  const frame = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={accessibilityLabel ?? 'Your photo'}
        style={[styles.frame, frame]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.frame, styles.initialsBox, frame]} accessible={false}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.ashRaised },
  initialsBox: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fontFamily.uiBold, color: colors.bone, letterSpacing: 0.02 * 16 },
});
