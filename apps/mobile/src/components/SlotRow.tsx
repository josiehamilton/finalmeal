import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Pick } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

interface SlotRowProps {
  pick: Pick;
  onPress: () => void;
  /** A radio row, as in Swap. Otherwise the row is a button (a link to the pick). */
  selectable?: boolean;
  selected?: boolean;
}

/** A Final Meal row: the slot numeral, a thumbnail, the dish and its restaurant and city. The selected row is struck through in ember glow. */
export function SlotRow({ pick, onPress, selectable = false, selected = false }: SlotRowProps) {
  // The line under the dish is the restaurant and its city, as on the Profile and Swap boards.
  const where = `${pick.place.name} · ${pick.place.city}`;
  const label = `${pick.slot ? `${pick.slot}. ` : ''}${pick.dish.name}, ${where}`;
  return (
    <Pressable
      accessibilityRole={selectable ? 'radio' : 'button'}
      accessibilityLabel={label}
      accessibilityState={selectable ? { checked: selected } : undefined}
      onPress={onPress}
      style={[styles.row, selected && styles.rowOn]}
    >
      {pick.slot ? <Text style={styles.numeral}>{pick.slot}</Text> : null}
      <View style={styles.thumb}>
        {pick.photoUrl ? (
          <Image testID="slot-thumb" source={{ uri: pick.photoUrl }} style={styles.thumbImage} />
        ) : (
          <Icon name="image" size={16} color={colors.dim} />
        )}
      </View>
      <View style={styles.text}>
        {/* The strike is drawn as a line: textDecorationColor only works on iOS. */}
        <View style={styles.dishWrap}>
          <Text style={styles.dish} numberOfLines={1}>
            {pick.dish.name}
          </Text>
          {selected ? <View testID="strike-line" pointerEvents="none" style={styles.strike} /> : null}
        </View>
        <Text style={styles.where} numberOfLines={1}>
          {where}
        </Text>
      </View>
      {selectable ? (
        <View style={[styles.radio, selected && styles.radioOn]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : (
        <Icon name="chev" size={18} color={colors.smoke} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ash,
  },
  rowOn: { borderWidth: 1.5, borderColor: colors.emberGlow, backgroundColor: colors.emberWash },
  numeral: {
    width: 20,
    fontFamily: fontFamily.serifItalic,
    fontSize: 30,
    lineHeight: 34,
    color: colors.emberGlow,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: 44, height: 44 },
  text: { flex: 1, gap: 2, minWidth: 0 },
  dish: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  dishWrap: { alignSelf: 'flex-start', maxWidth: '100%', justifyContent: 'center' },
  strike: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: colors.emberGlow,
  },
  where: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.emberGlow },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.emberGlow },
});
