import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

interface TagChipProps {
  label: string;
  onPress: () => void;
  /**
   * `tag` toggles (selected = ember wash with a check); `more` is the dashed ember "More" link
   * to tag search; `own` is the dashed "Your own" chip that makes a personal tag.
   */
  variant?: 'tag' | 'more' | 'own';
  selected?: boolean;
}

/** The canvas pill: 36 high, ember-wash when selected. */
export function TagChip({ label, onPress, variant = 'tag', selected = false }: TagChipProps) {
  const isTag = variant === 'tag';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={isTag ? { selected } : undefined}
      onPress={onPress}
      style={[
        styles.chip,
        isTag && (selected ? styles.selected : styles.plain),
        variant === 'more' && styles.more,
        variant === 'own' && styles.own,
      ]}
    >
      {isTag && selected ? (
        <Icon name="check" size={14} color={colors.emberGlow} strokeWidth={2.5} />
      ) : null}
      {variant === 'more' ? <Icon name="search" size={14} color={colors.emberGlow} /> : null}
      {variant === 'own' ? <Icon name="plus" size={14} color={colors.smoke} /> : null}
      <Text
        style={[
          styles.label,
          variant === 'more' && styles.moreLabel,
          variant === 'own' && styles.ownLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plain: { borderWidth: 1, borderColor: colors.lineStrong },
  selected: {
    backgroundColor: colors.emberWash,
    borderWidth: 1.5,
    borderColor: colors.emberGlow,
  },
  more: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.emberGlow },
  own: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lineStrong },
  label: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.bone },
  moreLabel: { fontFamily: fontFamily.uiBold, color: colors.emberGlow },
  ownLabel: { color: colors.smoke },
});
