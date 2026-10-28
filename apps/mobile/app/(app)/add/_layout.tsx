import { Stack, useLocalSearchParams } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { AddDishProvider, tierFromParam } from '../../../src/state/add-dish';

/**
 * The Add-a-dish flow: a stack of its own, presented as a modal from the (app) stack. One draft
 * is shared by all of its screens and goes away when the modal closes. A `tier` route param
 * (the You tab's empty seats pass `final`) sets the tier the draft starts with.
 */
export default function AddLayout() {
  const { tier } = useLocalSearchParams<{ tier?: string }>();
  const startTier = tierFromParam(tier);
  return (
    <AddDishProvider initial={startTier ? { tier: startTier } : undefined}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}
      >
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.ash } }} />
      </Stack>
    </AddDishProvider>
  );
}
