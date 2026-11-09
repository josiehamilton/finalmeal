import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { DiscoverDish } from '@finalmeal/api';
import { formatDistance, tierCountsLabel } from '@finalmeal/core';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { DishPhoto } from './DishPhoto';
import { SkullMark } from './SkullMark';

interface SelectedPlaceSheetProps {
  dishes: DiscoverDish[];
  onOpenPick: (pickId: string) => void;
  /** Leaves the selected spot, back to the picks in view. */
  onClose: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

/** `Kin Kao · Main St · 1.8 km`: the place, where it is, how far; parts that are missing are left out. */
export function whereLine(dish: DiscoverDish): string {
  const { place } = dish;
  return [place.name, place.area ?? place.address, formatDistance(dish.distanceM)]
    .filter((part): part is string => !!part)
    .join(' · ');
}

function DishBlock({ dish, onOpenPick }: { dish: DiscoverDish; onOpenPick: (pickId: string) => void }) {
  const { pickId } = dish;
  const isFinal = dish.bestTier === 'final';
  const counts = tierCountsLabel(dish.finalCount, dish.honorableCount, dish.bestTier);
  return (
    <Pressable
      accessibilityRole={pickId ? 'button' : undefined}
      accessibilityLabel={`${dish.dishName}, ${whereLine(dish)}`}
      onPress={pickId ? () => onOpenPick(pickId) : undefined}
      style={styles.block}
    >
      <View style={styles.photoRow}>
        <DishPhoto uri={dish.photoUrl} size={84} radius={14} />
        <View style={styles.text}>
          <View style={[styles.badge, !isFinal && styles.badgeHonorable]}>
            {isFinal ? <SkullMark size={12} color={colors.white} /> : null}
            <Text style={[styles.badgeText, !isFinal && styles.badgeTextHonorable]}>
              {isFinal ? 'Final Meal' : 'Honorable'}
            </Text>
          </View>
          <Text style={styles.dish}>{dish.dishName}</Text>
          <Text style={styles.where}>{whereLine(dish)}</Text>
        </View>
      </View>
      {dish.people.length > 0 || counts ? (
        <View style={styles.people}>
          {dish.people.length > 0 ? (
            <View style={styles.avatars}>
              {dish.people.map((person, i) => (
                <View key={person.id} testID="selected-avatar" style={[styles.ring, i > 0 && styles.overlap]}>
                  <Avatar
                    uri={person.avatarUrl}
                    name={person.displayName}
                    size={24}
                    accessibilityLabel={`${person.displayName}’s photo`}
                  />
                </View>
              ))}
            </View>
          ) : null}
          {counts ? <Text style={styles.counts}>{counts}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** Replaces the in-view sheet while a pin is selected: every dish picked at that place. */
export function SelectedPlaceSheet({ dishes, onOpenPick, onClose, onLayout }: SelectedPlaceSheetProps) {
  const { height } = useWindowDimensions();
  return (
    <View
      accessibilityLabel="Selected pick"
      // A screen reader's escape gesture (two-finger Z) leaves the spot, like the Close button.
      onAccessibilityEscape={onClose}
      style={styles.sheet}
      onLayout={onLayout}
    >
      <View style={styles.top}>
        <View accessible={false} style={styles.handle} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={8}
          style={styles.close}
        >
          <Icon name="close" size={16} color={colors.smoke} />
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: height / 2 }} contentContainerStyle={styles.blocks}>
        {dishes.map((dish) => (
          <DishBlock key={dish.dishId} dish={dish} onOpenPick={onOpenPick} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: colors.ash,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: colors.lineStrong,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
  },
  blocks: { gap: 20 },
  block: { gap: 12 },
  photoRow: { flexDirection: 'row', gap: 14 },
  top: { height: 28, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 5, minWidth: 0 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.ember,
  },
  badgeHonorable: { backgroundColor: colors.scrim, borderWidth: 1, borderColor: colors.lineStrong },
  badgeText: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    color: colors.white,
  },
  badgeTextHonorable: { color: colors.honorable },
  dish: { fontFamily: fontFamily.serif, fontSize: 22, lineHeight: 22 * 1.1, color: colors.bone },
  where: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  people: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatars: { flexDirection: 'row' },
  ring: { borderWidth: 2, borderColor: colors.ash, borderRadius: 14 },
  overlap: { marginLeft: -8 },
  counts: { flexShrink: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
});
