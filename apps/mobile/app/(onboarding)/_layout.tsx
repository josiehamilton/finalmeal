import { Stack } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';

/** Welcome and the sign-up steps. Each screen moves forward explicitly; there is no gate here. */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.night },
      }}
    />
  );
}
