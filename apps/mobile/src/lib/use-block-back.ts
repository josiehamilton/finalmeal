import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * While this screen is focused, swallows the Android hardware back button. Used on screens
 * you must not go back from (step 5 once the profile exists, and the loading screen).
 * iOS swipe-back is switched off for the same screens in the onboarding layout.
 * Pass `enabled = false` to let back through again (a screen that only blocks while saving).
 */
export function useBlockBack(enabled = true): void {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, [enabled]),
  );
}
