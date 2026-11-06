import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

interface ToggleRowProps {
  label: string;
  /** A line of explanation under the label. */
  sub?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  /** A save for this row is in flight. */
  disabled?: boolean;
}

/** A settings row with a 52 by 32 switch: ember track when on, a dark one when off. */
export function ToggleRow({ label, sub, value, onChange, disabled = false }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={() => onChange(!value)}
        hitSlop={6}
        style={[
          styles.track,
          { backgroundColor: value ? colors.ember : colors.switchOff },
          { justifyContent: value ? 'flex-end' : 'flex-start' },
        ]}
      >
        <View style={styles.thumb} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  text: { flex: 1, gap: 3 },
  label: { fontFamily: fontFamily.uiSemiBold, fontSize: 15, color: colors.bone },
  sub: { fontFamily: fontFamily.ui, fontSize: 13, lineHeight: 13 * 1.4, color: colors.smoke },
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white },
});
