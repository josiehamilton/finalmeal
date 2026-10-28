import { Stack } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { AddDishProvider } from '../../../../../src/state/add-dish';

/**
 * Editing a pick: a stack of its own (the form and tag search), sharing one draft of the pick's
 * note, photo and tags, the same draft the Add-a-dish flow uses so the same components work.
 */
export default function EditLayout() {
  return (
    <AddDishProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }} />
    </AddDishProvider>
  );
}
