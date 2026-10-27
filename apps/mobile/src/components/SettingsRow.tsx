import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface SettingsRowProps {
  icon: IconName;
  label: string;
  /** Right-aligned detail, such as the current city. */
  value?: string;
  /** Leave out for a row that only shows information. */
  onPress?: () => void;
  /** Paints the row in the danger colour and drops the chevron (Log out). */
  danger?: boolean;
}

export function SettingsRow({ icon, label, value, onPress, danger = false }: SettingsRowProps) {
  const tint = danger ? colors.danger : colors.smoke;
  const content = (
    <>
      <Icon name={icon} size={20} color={tint} />
      <Text style={[styles.label, danger && { color: colors.danger }]}>{label}</Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && !danger ? <Icon name="chev" size={18} color={colors.dim} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: {
    flexGrow: 1,
    flexShrink: 0,
    fontFamily: fontFamily.uiSemiBold,
    fontSize: 15,
    color: colors.bone,
  },
  value: { flexShrink: 1, fontFamily: fontFamily.ui, fontSize: 14, color: colors.smoke },
});
