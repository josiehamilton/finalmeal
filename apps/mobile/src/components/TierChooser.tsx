import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { tierSubCopy } from '../state/add-dish';
import { SkullMark } from './SkullMark';

interface TierChooserProps {
  value: 'final' | 'honorable';
  onChange: (tier: 'final' | 'honorable') => void;
  /** How many Final Meal picks the person has, or null while unknown. */
  finalCount: number | null;
}

/** "Add to": the Final Meal or an Honorable mention, as two radio cards. */
export function TierChooser({ value, onChange, finalCount }: TierChooserProps) {
  const finalOn = value === 'final';
  const subCopy = tierSubCopy(finalCount);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Add to</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="List" style={styles.row}>
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel={`Final Meal${subCopy ? `. ${subCopy}` : ''}`}
          accessibilityState={{ checked: finalOn }}
          onPress={() => onChange('final')}
          style={[styles.card, finalOn ? styles.cardOn : styles.cardOff]}
        >
          <View style={styles.title}>
            <SkullMark size={16} color={finalOn ? colors.emberGlow : colors.honorable} />
            <Text style={styles.titleText}>Final Meal</Text>
          </View>
          {subCopy ? <Text style={styles.sub}>{subCopy}</Text> : null}
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityLabel="Honorable. Unlimited runners-up."
          accessibilityState={{ checked: !finalOn }}
          onPress={() => onChange('honorable')}
          style={[styles.card, !finalOn ? styles.cardOn : styles.cardOff]}
        >
          <View style={styles.title}>
            <View style={styles.dot}>
              {!finalOn ? <View style={styles.dotFill} /> : null}
            </View>
            <Text style={styles.titleText}>Honorable</Text>
          </View>
          <Text style={styles.sub}>Unlimited runners-up.</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  row: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, gap: 6, padding: 14, borderRadius: 16 },
  cardOn: {
    borderWidth: 1.5,
    borderColor: colors.emberGlow,
    backgroundColor: colors.emberWash,
  },
  cardOff: { borderWidth: 1, borderColor: colors.lineStrong },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  sub: { fontFamily: fontFamily.ui, fontSize: 12, lineHeight: 12 * 1.4, color: colors.smoke },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.honorable,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFill: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.honorable },
});
