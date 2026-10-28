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
      {/* Back from Name signs out and starts over, so it goes through the screen's own Back. */}
      <Stack.Screen name="name" options={{ gestureEnabled: false }} />
      {/* The profile exists from step 5 on, and the loading screen is a hand-over: no swiping back. */}
      <Stack.Screen name="city" options={{ gestureEnabled: false }} />
      {/* Same for the first-pick intro. The form after it can be left with Back, but not mid-save. */}
      <Stack.Screen name="first-pick" options={{ gestureEnabled: false }} />
      <Stack.Screen name="loading" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
