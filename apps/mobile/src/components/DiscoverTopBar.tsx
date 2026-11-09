import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DiscoverTier } from '@finalmeal/core';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

const TIERS: { tier: DiscoverTier; label: string }[] = [
  { tier: 'all', label: 'All' },
  { tier: 'final', label: 'Final Meals' },
  { tier: 'honorable', label: 'Honorable' },
];

interface DiscoverTopBarProps {
  tier: DiscoverTier;
  followingOnly: boolean;
  /** How many filters the Filters sheet holds (a radius, plus each tag). */
  sheetFilterCount: number;
  onTier: (tier: DiscoverTier) => void;
  onToggleFollowing: () => void;
  onSearch: () => void;
  onFilters: () => void;
  /** The bar's height, so the map and the legend stay clear of it. */
  onLayout: (event: LayoutChangeEvent) => void;
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
      <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
  );
}

/** Discover's floating top: the search pill, the Filters button and the chip row, over the map. */
export function DiscoverTopBar({
  tier,
  followingOnly,
  sheetFilterCount,
  onTier,
  onToggleFollowing,
  onSearch,
  onFilters,
  onLayout,
}: DiscoverTopBarProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.wrap} pointerEvents="box-none" onLayout={onLayout}>
      <View style={styles.inner} pointerEvents="box-none">
        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="search"
            accessibilityLabel="Search dishes, spots, people"
            onPress={onSearch}
            style={styles.pill}
          >
            <Icon name="search" size={19} color={colors.smoke} />
            <Text style={styles.pillText}>Dishes, spots, people</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filters"
            accessibilityValue={sheetFilterCount > 0 ? { text: `${sheetFilterCount} on` } : undefined}
            onPress={onFilters}
            style={styles.filters}
          >
            <Icon name="sliders" size={21} color={colors.bone} />
            {sheetFilterCount > 0 ? <View testID="filters-dot" style={styles.dot} /> : null}
          </Pressable>
        </View>
        <View style={styles.chips} pointerEvents="box-none">
          {TIERS.map(({ tier: value, label }) => (
            <Chip key={value} label={label} on={tier === value} onPress={() => onTier(value)} />
          ))}
          <Chip label="Following" on={followingOnly} onPress={onToggleFollowing} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  inner: { paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pill: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  pillText: { fontFamily: fontFamily.ui, fontSize: 15, color: colors.smoke },
  filters: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emberGlow,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  chipOn: { backgroundColor: colors.bone, borderColor: colors.bone },
  chipLabel: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.bone },
  chipLabelOn: { color: colors.night },
});
