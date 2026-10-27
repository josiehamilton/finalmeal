import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { pickPhoto } from '../lib/pick-photo';
import type { PhotoSource } from '../lib/pick-photo';
import { Icon } from './Icon';

interface PhotoFieldProps {
  uri: string | null;
  onChange: (uri: string | null) => void;
}

/** The square Photo tile beside "Photo (optional)." Tapping it offers the camera or the library. */
export function PhotoField({ uri, onChange }: PhotoFieldProps) {
  async function pick(source: PhotoSource) {
    const result = await pickPhoto(source, { crop: false });
    if (result.status === 'picked') onChange(result.uri);
    // Canceled or denied: nothing changes. A photo is optional, so there is nothing to nag about.
  }

  function choose() {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take a photo', onPress: () => void pick('camera') },
      { text: 'Choose from library', onPress: () => void pick('library') },
      ...(uri ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => onChange(null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Photo"
        onPress={choose}
        style={styles.tile}
      >
        {uri ? (
          <Image source={{ uri }} accessibilityLabel="Your photo" style={styles.image} />
        ) : (
          <>
            <Icon name="camera" size={22} color={colors.smoke} />
            <Text style={styles.tileLabel}>Photo</Text>
          </>
        )}
      </Pressable>
      <Text style={styles.copy}>
        <Text style={styles.copyStrong}>Photo (optional).</Text> Only your own. We never use stock
        images.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  image: { width: 72, height: 72 },
  tileLabel: { fontFamily: fontFamily.uiSemiBold, fontSize: 12, color: colors.smoke },
  copy: {
    flex: 1,
    fontFamily: fontFamily.ui,
    fontSize: 13,
    lineHeight: 13 * 1.5,
    color: colors.smoke,
  },
  copyStrong: { fontFamily: fontFamily.uiBold, color: colors.bone },
});
