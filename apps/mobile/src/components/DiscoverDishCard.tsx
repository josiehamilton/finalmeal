import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiscoverDish } from '@finalmeal/api';
import { listsLabel } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { DishPhoto } from './DishPhoto';

interface DiscoverDishCardProps {
  dish: DiscoverDish;
  onOpenPick: (pickId: string) => void;
}

/** `Final Meal · 14 lists`, or just the tier when no list counts. */
export function tierMeta(dish: Pick<DiscoverDish, 'bestTier' | 'listCount'>): string {
  const tier = dish.bestTier === 'final' ? 'Final Meal' : 'Honorable';
  const lists = listsLabel(dish.listCount);
  return lists ? `${tier} · ${lists}` : tier;
}

/** One dish in the sheet's row. It opens the pick only when the viewer may see one (`pickId`). */
export function DiscoverDishCard({ dish, onOpenPick }: DiscoverDishCardProps) {
  const { pickId } = dish;
  const isFinal = dish.bestTier === 'final';
  return (
    <Pressable
      // A card with no pick the viewer may open is not a link, so it is not announced as one.
      accessibilityRole={pickId ? 'button' : undefined}
      accessibilityLabel={`${dish.dishName}, ${dish.place.name}, ${tierMeta(dish)}`}
      onPress={pickId ? () => onOpenPick(pickId) : undefined}
      style={styles.card}
    >
      <DishPhoto uri={dish.photoUrl} size={64} radius={12} />
      <View style={styles.text}>
        <Text style={styles.dish} numberOfLines={1}>
          {dish.dishName}
        </Text>
        <Text style={styles.place} numberOfLines={1}>
          {dish.place.name}
        </Text>
        <Text style={[styles.meta, { color: isFinal ? colors.emberGlow : colors.honorable }]} numberOfLines={1}>
          {tierMeta(dish)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.ashRaised,
  },
  text: { flex: 1, justifyContent: 'center', gap: 3, minWidth: 0 },
  dish: { fontFamily: fontFamily.serif, fontSize: 19, color: colors.bone },
  place: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  meta: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    textTransform: 'uppercase',
  },
});
