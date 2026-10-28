import { Stack } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { AddDishProvider } from '../../../src/state/add-dish';
import { AddFlowBase } from '../../../src/state/add-flow-base';

/**
 * The first pick during onboarding: the Add-a-dish form locked to Final Meal, with the same
 * restaurant and tag search screens, in a stack of its own under its own draft (the way Edit
 * does it). The shared place screens find their sibling routes through AddFlowBase.
 */
export default function AddFirstLayout() {
  return (
    <AddDishProvider initial={{ tier: 'final' }}>
      <AddFlowBase base="/add-first">
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.night } }}
        />
      </AddFlowBase>
    </AddDishProvider>
  );
}
