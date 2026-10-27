import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

const SEATS = [1, 2, 3, 4, 5] as const;

/** The five numbered, still-empty seats of a Final Meal. Seat 1 says where the first pick goes. */
export function EmptySeats() {
  return (
    <View style={styles.list}>
      {SEATS.map((n) => (
        <View key={n} testID={`seat-${n}`} style={styles.seat}>
          <Text style={styles.numeral}>{n}</Text>
          {n === 1 ? <Text style={styles.caption}>Your first pick goes here.</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  seat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 72,
    paddingHorizontal: 16,
    borderRadius: radii.input,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  numeral: {
    width: 26,
    fontFamily: fontFamily.serifItalic,
    fontSize: 38,
    lineHeight: 38,
    color: colors.dim,
  },
  caption: { flex: 1, fontFamily: fontFamily.ui, fontSize: 14, color: colors.smoke },
});
