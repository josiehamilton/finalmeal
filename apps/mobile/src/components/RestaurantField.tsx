import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

interface RestaurantFieldProps {
  place: Place | null;
  /** Opens the restaurant search. */
  onPress: () => void;
}

/** The Restaurant row of the Add form: the chosen place with Change, or Choose a restaurant. */
export function RestaurantField({ place, onPress }: RestaurantFieldProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>Restaurant</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          place ? `Restaurant: ${place.name}, ${place.label}. Change` : 'Restaurant: Choose a restaurant'
        }
        onPress={onPress}
        style={styles.restaurant}
      >
        <Icon name="pin" size={20} color={place ? colors.emberGlow : colors.smoke} />
        {place ? (
          <>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.where} numberOfLines={1}>
                {place.label}
              </Text>
            </View>
            <Text style={styles.change}>Change</Text>
          </>
        ) : (
          <>
            <Text style={styles.empty}>Choose a restaurant</Text>
            <Icon name="chev" size={18} color={colors.smoke} />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  restaurant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 64,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  text: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontFamily: fontFamily.uiSemiBold, fontSize: 16, color: colors.bone },
  where: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  empty: { flex: 1, fontFamily: fontFamily.uiMedium, fontSize: 16, color: colors.dim },
  change: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.smoke },
});
