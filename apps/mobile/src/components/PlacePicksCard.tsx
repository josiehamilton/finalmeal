import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';

/** The most dishes a card lists before it says how many more there are. */
const MAX_ROWS = 3;

export interface PlacePicksRow {
  key: string;
  dishName: string;
  /** What follows the dish name: ` · Final Meal`, ` · Honorable`, ` · via @ari`. */
  suffix: string;
  /** Opens the dish; a row without it is not a link. */
  onPress?: () => void;
}

interface PlacePicksCardProps {
  placeName: string;
  rows: PlacePicksRow[];
  onClose: () => void;
}

/** What a tapped map pin shows in place of the footer: the place and up to three dishes there. */
export function PlacePicksCard({ placeName, rows, onClose }: PlacePicksCardProps) {
  const shown = rows.slice(0, MAX_ROWS);
  const more = rows.length - shown.length;
  return (
    <View style={styles.card} testID="place-picks-card" accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Text style={styles.place} numberOfLines={1} accessibilityRole="header">
          {placeName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.close}
        >
          <Icon name="close" size={18} color={colors.smoke} />
        </Pressable>
      </View>
      {shown.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole={row.onPress ? 'button' : undefined}
          accessibilityLabel={`${row.dishName}${row.suffix}`}
          onPress={row.onPress}
          style={styles.row}
        >
          <Text style={styles.dish} numberOfLines={1}>
            {row.dishName}
            <Text style={styles.suffix}>{row.suffix}</Text>
          </Text>
        </Pressable>
      ))}
      {more > 0 ? <Text style={styles.more}>{`+ ${more} more`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.glass,
    gap: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, marginVertical: -12, marginRight: -14, alignItems: 'center', justifyContent: 'center' },
  place: { flex: 1, fontFamily: fontFamily.uiBold, fontSize: 13, color: colors.bone },
  row: { minHeight: 44, justifyContent: 'center' },
  dish: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.bone },
  suffix: { color: colors.smoke },
  more: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
});
