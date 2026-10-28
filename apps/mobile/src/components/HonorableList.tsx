import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Pick } from '@finalmeal/api';
import type { PlaceGroup } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';
import { TagChips } from './TagChips';

interface HonorableListProps {
  groups: ReadonlyArray<PlaceGroup<Pick>>;
  onOpen: (pick: Pick) => void;
}

/** The honorable mentions grouped by restaurant, as on the ProfileHM board. */
export function HonorableList({ groups, onOpen }: HonorableListProps) {
  return (
    <View>
      {groups.map(({ place, picks }) => (
        <View key={place.id} testID={`group-${place.id}`} style={styles.group}>
          <View style={styles.header}>
            <View style={styles.pin}>
              <Icon name="pin" size={18} color={colors.emberGlow} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.place} numberOfLines={1} accessibilityRole="header">
                {place.name}
              </Text>
              <Text style={styles.where} numberOfLines={1}>
                {place.label}
                {picks.length >= 2 ? (
                  <>
                    {' · '}
                    <Text style={styles.count}>{`${picks.length} dishes`}</Text>
                  </>
                ) : null}
              </Text>
            </View>
          </View>
          <View style={styles.dishes}>
            {picks.map((pick) => (
              <Pressable
                key={pick.id}
                accessibilityRole="button"
                accessibilityLabel={`${pick.dish.name}, Honorable, ${place.name}`}
                onPress={() => onOpen(pick)}
                style={styles.dish}
              >
                <View style={styles.thumb}>
                  {pick.photoUrl ? (
                    <Image source={{ uri: pick.photoUrl }} style={styles.thumbImage} />
                  ) : (
                    <Icon name="image" size={15} color={colors.dim} />
                  )}
                </View>
                <View style={styles.dishText}>
                  <Text style={styles.dishName} numberOfLines={2}>
                    {pick.dish.name}
                  </Text>
                  <Text style={styles.badge}>Honorable</Text>
                  <TagChips tags={pick.tags} />
                </View>
                <Icon name="chev" size={18} color={colors.smoke} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2, minWidth: 0 },
  place: {
    fontFamily: fontFamily.uiBold,
    fontSize: 16,
    letterSpacing: 0.005 * 16,
    color: colors.bone,
  },
  where: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  count: { fontFamily: fontFamily.uiBold, color: colors.bone },
  dishes: {
    gap: 12,
    marginLeft: 19,
    paddingLeft: 32,
    borderLeftWidth: 1,
    borderLeftColor: colors.lineStrong,
  },
  dish: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: 42, height: 42 },
  dishText: { flex: 1, gap: 3, minWidth: 0 },
  dishName: { fontFamily: fontFamily.serif, fontSize: 18, lineHeight: 18 * 1.1, color: colors.bone },
  badge: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    textTransform: 'uppercase',
    color: colors.honorable,
  },
});
