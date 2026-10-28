import { StyleSheet, View } from 'react-native';
import type { Pick } from '@finalmeal/api';
import { EmptySeats } from './EmptySeats';
import { SlotRow } from './SlotRow';

/** How much a final that does not match the filter is faded. */
export const DIMMED_OPACITY = 0.35;

interface FinalMealListProps {
  /** The Final Meal picks, in slot order (slots 1..n). */
  picks: readonly Pick[];
  /** The ids to dim under a filter (they keep their place and number); null when nothing is filtered. */
  dimmedIds: ReadonlySet<string> | null;
  onOpen: (pick: Pick) => void;
  /** Opens Add a dish with Final Meal chosen. */
  onAdd: () => void;
}

/** The Final Meal: the filled slots, then the seats still open. */
export function FinalMealList({ picks, dimmedIds, onOpen, onAdd }: FinalMealListProps) {
  return (
    <View style={styles.list}>
      {picks.map((pick) => (
        <View
          key={pick.id}
          testID={`final-row-${pick.id}`}
          style={{ opacity: dimmedIds?.has(pick.id) ? DIMMED_OPACITY : 1 }}
        >
          <SlotRow pick={pick} onPress={() => onOpen(pick)} />
        </View>
      ))}
      <EmptySeats first={picks.length + 1} onAdd={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: 10 } });
