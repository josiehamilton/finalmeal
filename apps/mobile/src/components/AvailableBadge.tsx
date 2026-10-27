import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

/** The green-ish "Available" tick shown at the end of a username field. */
export function AvailableBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Available">
      <Icon name="check" size={16} color={colors.honorable} strokeWidth={2.25} />
      <Text style={styles.text}>Available</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.honorable },
});
