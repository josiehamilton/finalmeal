import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { SkullMark } from './SkullMark';

interface MapLegendProps {
  /** Distance from the top of the screen, just under the chip row. */
  top: number;
}

/** What the two pin styles mean: the ember skull is a Final Meal, the bone dot an Honorable Mention. */
export function MapLegend({ top }: MapLegendProps) {
  return (
    <View style={[styles.box, { top }]} pointerEvents="none" accessible accessibilityLabel="Final Meal, Honorable">
      <View style={styles.row}>
        <View style={styles.disc}>
          <SkullMark size={9} color={colors.white} />
        </View>
        <Text style={styles.text}>Final Meal</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.dotSlot}>
          <View style={styles.dot} />
        </View>
        <Text style={styles.text}>Honorable</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    right: 16,
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disc: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotSlot: { width: 18, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.honorable },
  text: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
});
