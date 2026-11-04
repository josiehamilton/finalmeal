import { StyleSheet, Text, View } from 'react-native';
import type { PersonSummary } from '@finalmeal/api';
import { countLabel } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Avatar } from './Avatar';

const MAX_AVATARS = 4;
const AVATAR_SIZE = 32;

interface PickersRowProps {
  /** Some of the people who have the dish as a Final Meal. */
  pickers: readonly PersonSummary[];
  /** How many people have it as a Final Meal. */
  finalCount: number;
}

/** Up to four overlapping avatars, then "On 23 Final Meals". Not tappable this phase; hidden at zero. */
export function PickersRow({ pickers, finalCount }: PickersRowProps) {
  const label = countLabel(finalCount, 'finalMeal');
  if (!label) return null;
  return (
    <View style={styles.row}>
      <View style={styles.avatars}>
        {pickers.slice(0, MAX_AVATARS).map((person, i) => (
          <View
            key={person.id}
            testID="picker-avatar"
            style={[styles.ring, i > 0 && styles.overlap]}
          >
            <Avatar
              uri={person.avatarUrl}
              name={person.displayName}
              size={AVATAR_SIZE}
              accessibilityLabel={`${person.displayName}’s photo`}
            />
          </View>
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatars: { flexDirection: 'row' },
  ring: { borderWidth: 2, borderColor: colors.night, borderRadius: (AVATAR_SIZE + 4) / 2 },
  overlap: { marginLeft: -10 },
  label: { flex: 1, fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.bone },
});
