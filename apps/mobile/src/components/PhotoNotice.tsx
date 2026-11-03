import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { dismissPhotoNotice, usePhotoNotice } from '../state/pick-changes';
import { Icon } from './Icon';

/**
 * The "Saved without the photo" banner. Shows while a pick has been saved without its photo and
 * the notice hasn't been dismissed; renders nothing otherwise. The You tab and First landing both
 * show it, so it appears wherever the person lands after saving.
 */
export function PhotoNotice({ style }: { style?: StyleProp<ViewStyle> }) {
  const visible = usePhotoNotice();
  if (!visible) return null;
  return (
    <View style={[styles.notice, style]} accessibilityRole="alert">
      <Text style={styles.noticeText}>Saved without the photo. Add it from the dish any time.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={dismissPhotoNotice}
        hitSlop={8}
      >
        <Icon name="close" size={18} color={colors.smoke} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  noticeText: { flex: 1, fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.bone },
});
