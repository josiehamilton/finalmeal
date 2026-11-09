import { Image, StyleSheet, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { Icon } from './Icon';

interface DishPhotoProps {
  uri: string | null;
  size: number;
  radius: number;
}

/** A dish's photo, or the raised placeholder tile with the image glyph. Decorative: the text beside it names the dish. */
export function DishPhoto({ uri, size, radius }: DishPhotoProps) {
  const frame = { width: size, height: size, borderRadius: radius };
  if (uri) {
    return <Image testID="dish-photo" source={{ uri }} accessible={false} style={[styles.frame, frame]} />;
  }
  return (
    <View testID="dish-photo-placeholder" style={[styles.frame, styles.placeholder, frame]}>
      <Icon name="image" size={Math.round(size * 0.36)} color={colors.dim} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.ashRaised, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
