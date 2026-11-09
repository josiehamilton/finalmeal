import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DiscoverDish } from '@finalmeal/api';
import { formatDistance, listsLabel } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { DishPhoto } from './DishPhoto';

interface DishResultRowProps {
  dish: DiscoverDish;
  onPress: (dish: DiscoverDish) => void;
}

/** A dish in a list: photo, dish, `Marutama · 1.2 km`, and how many lists it is on. */
export function DishResultRow({ dish, onPress }: DishResultRowProps) {
  const where = [dish.place.name, formatDistance(dish.distanceM)].filter(Boolean).join(' · ');
  const lists = listsLabel(dish.listCount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dish.dishName}, ${where}`}
      onPress={() => onPress(dish)}
      style={styles.row}
    >
      <DishPhoto uri={dish.photoUrl} size={48} radius={10} />
      <View style={styles.text}>
        <Text style={styles.dish} numberOfLines={1}>
          {dish.dishName}
        </Text>
        <Text style={styles.where} numberOfLines={1}>
          {where}
        </Text>
      </View>
      {lists ? <Text style={styles.lists}>{lists}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  text: { flex: 1, gap: 2, minWidth: 0 },
  dish: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  where: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  lists: { fontFamily: fontFamily.uiBold, fontSize: 12, color: colors.emberGlow },
});
