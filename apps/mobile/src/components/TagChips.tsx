import { StyleSheet, Text, View } from 'react-native';
import type { Tag } from '@finalmeal/api';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';

/** The read-only tag pills on a pick: 24 high, raised ash, as on the PickDetail board. */
export function TagChips({ tags }: { tags: readonly Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <View testID="tag-chips" style={styles.row}>
      {tags.map((tag) => (
        <View key={tag.id} style={styles.chip}>
          <Text style={styles.label}>{tag.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.ashRaised,
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.uiSemiBold,
    fontSize: 11,
    letterSpacing: 0.01 * 11,
    color: colors.honorable,
  },
});
