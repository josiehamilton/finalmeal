import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ChipOption } from '@finalmeal/core';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

/** Tells two chips apart: a city and a tag can share a value, and so can a food and a personal tag. */
export function chipKey(option: ChipOption): string {
  return `${option.kind}:${option.tagKind ?? ''}:${option.value}`;
}

interface FilterChipsProps {
  options: readonly ChipOption[];
  /** The active chip, or null for All. */
  selected: ChipOption | null;
  onSelect: (option: ChipOption | null) => void;
}

interface ChipProps {
  label: string;
  on: boolean;
  onPress: () => void;
}

function Chip({ label, on, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
    >
      {on ? <Icon name="check" size={13} color={colors.emberGlow} strokeWidth={2.5} /> : null}
      <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
    </Pressable>
  );
}

/** The single-select filter row under the profile tabs: All, then the cities, then the tags. */
export function FilterChips({ options, selected, onSelect }: FilterChipsProps) {
  const selectedKey = selected ? chipKey(selected) : null;
  return (
    <ScrollView
      testID="filter-chips"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Chip label="All" on={selectedKey === null} onPress={() => onSelect(null)} />
      {options.map((option) => (
        <Chip
          key={chipKey(option)}
          label={option.label}
          on={selectedKey === chipKey(option)}
          onPress={() => onSelect(option)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  chipOn: { borderWidth: 1.5, borderColor: colors.emberGlow, backgroundColor: colors.emberWash },
  label: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.smoke },
  labelOn: { color: colors.bone },
});
