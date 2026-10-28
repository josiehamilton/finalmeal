import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

const LAST_SEAT = 5;

interface EmptySeatsProps {
  /** The number of the first empty seat: one more than the Final Meal picks the person has. */
  first: number;
  /** Opens the Add-a-dish modal with Final Meal chosen. */
  onAdd: () => void;
}

/**
 * The dashed seats still open in a Final Meal. With one left it says so; with more it offers
 * `Add a dish` in each. All of them open Add a dish.
 */
export function EmptySeats({ first, onAdd }: EmptySeatsProps) {
  const seats = Array.from({ length: Math.max(0, LAST_SEAT - first + 1) }, (_, i) => first + i);
  const oneLeft = seats.length === 1;
  const text = oneLeft ? 'One seat left. Choose wisely.' : 'Add a dish';
  return (
    <View style={styles.list}>
      {seats.map((n) => (
        <Pressable
          key={n}
          testID={`seat-${n}`}
          accessibilityRole="button"
          accessibilityLabel={oneLeft ? text : `${text}, seat ${n}`}
          onPress={onAdd}
          style={styles.seat}
        >
          <Text style={styles.numeral}>{n}</Text>
          <View style={styles.plus}>
            <Icon name="plus" size={18} color={colors.smoke} />
          </View>
          <Text style={oneLeft ? styles.caption : styles.add}>{text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  numeral: {
    width: 20,
    fontFamily: fontFamily.serifItalic,
    fontSize: 30,
    lineHeight: 34,
    color: colors.dim,
  },
  plus: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    flex: 1,
    fontFamily: fontFamily.serifItalic,
    fontSize: 17,
    color: colors.smoke,
  },
  add: { flex: 1, fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
});
