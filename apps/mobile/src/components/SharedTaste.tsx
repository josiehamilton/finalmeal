import { StyleSheet, Text, View } from 'react-native';
import type { Pick } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { SkullMark } from './SkullMark';

/** The dishes on both lists (either tier), once each, in the order of `theirs`. */
export function sharedDishNames(mine: readonly Pick[], theirs: readonly Pick[]): string[] {
  const mineIds = new Set(mine.map((p) => p.dish.id));
  const seen = new Set<string>();
  const names: string[] = [];
  for (const pick of theirs) {
    if (!mineIds.has(pick.dish.id) || seen.has(pick.dish.id)) continue;
    seen.add(pick.dish.id);
    names.push(pick.dish.name);
  }
  return names;
}

interface SharedTasteProps {
  mine: readonly Pick[];
  theirs: readonly Pick[];
}

/** "You both love Plain Biryani + 1 more": the dishes you and they have both picked. Hidden when there are none. */
export function SharedTaste({ mine, theirs }: SharedTasteProps) {
  const names = sharedDishNames(mine, theirs);
  const first = names[0];
  if (first === undefined) return null;
  const more = names.length - 1;
  return (
    <View testID="shared-taste" style={styles.box}>
      <SkullMark size={14} color={colors.emberGlow} />
      <Text style={styles.text}>
        {'You both love '}
        <Text style={styles.dish}>{first}</Text>
        {more > 0 ? ` + ${more} more` : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.line,
  },
  text: { flex: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  dish: { fontFamily: fontFamily.uiBold, color: colors.bone },
});
