import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '@finalmeal/api';
import { formatDistance } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

interface SpotResultRowProps {
  place: Place;
  /** Metres from the search point; null when there is none (or it is not a fixed point). */
  distanceM: number | null;
  onPress: (place: Place) => void;
}

/** A spot in a list: a pin tile, its name, and `Bidwell St · 1.2 km` (the place's label without a distance). */
export function SpotResultRow({ place, distanceM, onPress }: SpotResultRowProps) {
  const distance = formatDistance(distanceM);
  const where = distance
    ? [place.area ?? place.address, distance].filter(Boolean).join(' · ')
    : place.label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${where}`}
      onPress={() => onPress(place)}
      style={styles.row}
    >
      <View style={styles.tile}>
        <Icon name="pin" size={18} color={colors.smoke} />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.where} numberOfLines={1}>
          {where}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: fontFamily.uiSemiBold, fontSize: 15, color: colors.bone },
  where: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
});
