import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { pickPhoto } from '../lib/pick-photo';
import type { PhotoSource } from '../lib/pick-photo';
import { Icon } from './Icon';

interface PhotoFieldProps {
  uri: string | null;
  onChange: (uri: string | null) => void;
  /** `tile` is the Add form's square tile beside its copy; `banner` is the full-width onboarding tile. */
  layout?: 'tile' | 'banner';
}

/** The Photo field. Tapping it offers the camera or the library. */
export function PhotoField({ uri, onChange, layout = 'tile' }: PhotoFieldProps) {
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

  if (layout === 'banner') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Photo' : 'Add a photo (optional)'}
        onPress={choose}
        style={styles.banner}
      >
        {uri ? (
          <Image source={{ uri }} accessibilityLabel="Your photo" style={styles.bannerImage} />
        ) : (
          <>
            <Icon name="camera" size={28} color={colors.smoke} />
            <Text style={styles.bannerLabel}>Add a photo (optional)</Text>
          </>
        )}
      </Pressable>
    );
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
  banner: {
    height: 104,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    backgroundColor: colors.ash,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerLabel: { fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
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
