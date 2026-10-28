import { Stack, useGlobalSearchParams } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { AddDishProvider, tierFromParam } from '../../../src/state/add-dish';

/**
 * The Add-a-dish flow: a stack of its own, presented as a modal from the (app) stack. One draft
 * is shared by all of its screens and goes away when the modal closes. A `tier` route param
 * (the You tab's empty seats pass `final`) sets the tier the draft starts with.
 */
export default function AddLayout() {
  // Global, not local: expo-router attaches search params only to the focused leaf route
  // (add/index), so this layout would never see them through useLocalSearchParams. Safe here
  // because AddDishProvider reads `initial` once, when the modal opens.
  const { tier } = useGlobalSearchParams<{ tier?: string }>();
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
