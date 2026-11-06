import { FlatList, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { SavedDish } from '@finalmeal/api';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';
import { SkullMark } from './SkullMark';

const PHOTO_HEIGHT = 168;
const SIDE = 20;
const GAP = 14;

interface SavedGridProps {
  saves: readonly SavedDish[];
  /** A card with a pick behind it was tapped. */
  onOpen: (save: SavedDish) => void;
  /** A card was long-pressed (or given the "Remove from Saved" accessibility action). */
  onRemove: (save: SavedDish) => void;
}

/**
 * The Saved board's two-column grid: a photo (or placeholder tile) with a Final Meal / Honorable
 * badge, the dish, where, and who it was saved from. When that pick is gone the card has no badge
 * and no "via" line, and tapping it does nothing.
 */
export function SavedGrid({ saves, onOpen, onRemove }: SavedGridProps) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 2 * SIDE - GAP) / 2;
  return (
    <FlatList
      data={saves}
      numColumns={2}
      keyExtractor={(save) => save.dish.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <SavedCard save={item} width={cardWidth} onOpen={onOpen} onRemove={onRemove} />
      )}
    />
  );
}

interface SavedCardProps {
  save: SavedDish;
  width: number;
  onOpen: (save: SavedDish) => void;
  onRemove: (save: SavedDish) => void;
}

function SavedCard({ save, width, onOpen, onRemove }: SavedCardProps) {
  const isFinal = save.viaTier === 'final';
  return (
    <Pressable
      // A card whose pick is gone has nothing to open, so it is not announced as a button.
      accessibilityRole={save.viaPickId ? 'button' : undefined}
      accessibilityLabel={`${save.dish.name}, ${save.place.name} · ${save.place.city}`}
      accessibilityActions={[{ name: 'remove', label: 'Remove from Saved' }]}
      onAccessibilityAction={() => onRemove(save)}
      onPress={save.viaPickId ? () => onOpen(save) : undefined}
      onLongPress={() => onRemove(save)}
      style={[styles.card, { width }]}
    >
      <View style={styles.photo}>
        {save.photoUrl ? (
          <Image testID="saved-photo" source={{ uri: save.photoUrl }} style={styles.photoImage} />
        ) : (
          <View testID="saved-placeholder" style={styles.placeholder}>
            <Icon name="image" size={28} color={colors.dim} />
          </View>
        )}
        {save.viaTier ? (
          <View style={[styles.badge, !isFinal && styles.badgeHonorable]}>
            {isFinal ? <SkullMark size={12} color={colors.white} /> : null}
            <Text style={[styles.badgeText, !isFinal && styles.badgeTextHonorable]}>
              {isFinal ? 'Final Meal' : 'Honorable'}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.text}>
        <Text style={styles.dish} numberOfLines={2}>
          {save.dish.name}
        </Text>
        <Text style={styles.where} numberOfLines={1}>
          {`${save.place.name} · ${save.place.city}`}
        </Text>
        {save.via ? (
          <Text style={styles.via} numberOfLines={1}>
            {`via @${save.via.username}`}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SIDE, paddingBottom: 24, gap: 20 },
  row: { gap: GAP },
  card: { gap: 8 },
  photo: { height: PHOTO_HEIGHT, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.ashRaised },
  photoImage: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.ember,
  },
  badgeHonorable: { backgroundColor: colors.ashRaised },
  badgeText: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    color: colors.white,
  },
  badgeTextHonorable: { color: colors.honorable },
  text: { gap: 2 },
  dish: { fontFamily: fontFamily.serif, fontSize: 19, lineHeight: 19 * 1.15, color: colors.bone },
  where: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  via: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.dim },
});
