import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect } from 'react';
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

/**
 * Turns the iOS swipe-back gesture off for this screen while `blocked` (such as while saving),
 * so a swipe cannot pop the screen under a save that then navigates on its own. A screen that is
 * the first in a nested stack also passes `includeParent`, because the swipe belongs to the stack
 * above it. Does not affect `router` navigation.
 */
export function useBlockSwipeBack(blocked: boolean, { includeParent = false } = {}): void {
  const navigation = useNavigation();
  useEffect(() => {
    const options = { gestureEnabled: !blocked };
    navigation.setOptions(options);
    if (includeParent) navigation.getParent()?.setOptions(options);
  }, [navigation, blocked, includeParent]);
}

/**
 * The Add-a-dish modal can be swiped down to dismiss only when `allowed`: not while the form
 * has something in it, and not while a save is in flight. Sets the option on the modal route
 * (the parent of the add stack's screens).
 */
export function useModalSwipe(allowed: boolean): void {
  const navigation = useNavigation();
  useEffect(() => {
    navigation.getParent()?.setOptions({ gestureEnabled: allowed });
  }, [navigation, allowed]);
}
