import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** An action at the right edge, such as Save. */
  right?: ReactNode;
}

/** The canvas top bar for pushed screens: back arrow, 17-point bold title, optional action. */
export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={8}
        style={styles.back}
      >
        <Icon name="back" size={21} color={colors.bone} />
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 56,
    paddingLeft: 6,
    paddingRight: 12,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    fontFamily: fontFamily.uiBold,
    fontSize: 17,
    letterSpacing: 0.01 * 17,
    color: colors.bone,
  },
});
