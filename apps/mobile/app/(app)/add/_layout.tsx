import { Stack } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { AddDishProvider } from '../../../src/state/add-dish';

/**
 * The Add-a-dish flow: a stack of its own, presented as a modal from the (app) stack. One draft
 * is shared by all of its screens and goes away when the modal closes.
 */
export default function AddLayout() {
  return (
    <AddDishProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}
      >
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.ash } }} />
      </Stack>
    </AddDishProvider>
  );
}
