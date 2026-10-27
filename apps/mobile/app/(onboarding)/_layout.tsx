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
    >
      {/* The profile exists from step 5 on, and the loading screen is a hand-over: no swiping back. */}
      <Stack.Screen name="city" options={{ gestureEnabled: false }} />
      <Stack.Screen name="loading" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
