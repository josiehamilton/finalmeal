import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { signOut } from '@finalmeal/api';
import { DISPLAY_NAME_MAX } from '@finalmeal/core';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { TextField } from '../../src/components/TextField';
import { getSupabase } from '../../src/lib/supabase';

/** Step 3. The name travels to step 4 in the route; the profile is created there. */
export default function NameStep() {
  const router = useRouter();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  // A double "return" must not push the next step twice. Cleared when this screen is shown again.
  const leaving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );

  function next() {
    if (leaving.current) return;
    leaving.current = true;
    // Cap by characters, not UTF-16 units, so an emoji is never cut in half (the database counts characters too).
    const displayName = Array.from(`${first.trim()} ${last.trim()}`.trim())
      .slice(0, DISPLAY_NAME_MAX)
      .join('')
      .trim();
    router.push(`/username?name=${encodeURIComponent(displayName)}`);
  }

  // The account exists from the code step on, but the profile does not yet. Going back means
  // starting over, so end this device's sign-in (it also works offline) and begin at Email.
  // Normally Welcome and Email are behind this screen: pop back to that Email rather than adding a
  // second one (its Back would then lead to a stale copy). Resumed after a relaunch there is
  // nothing behind, so Email replaces this screen (and its own Back goes to Welcome).
  const goBack = useCallback(async () => {
    if (router.canGoBack()) router.dismissTo('/email');
    else router.replace('/email');
    try {
      await signOut(getSupabase(), 'local');
    } catch (e) {
      console.warn(e);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        void goBack();
        return true;
      });
      return () => subscription.remove();
    }, [goBack]),
  );

  return (
    <OnboardingScreen
      step={3}
      title="What should we call you?"
      subtitle="This shows on your profile and on every pick."
      onBack={goBack}
      cta={{ label: 'Continue', onPress: next, disabled: first.trim() === '' }}
    >
      <TextField
        label="First name"
        value={first}
        onChangeText={setFirst}
        maxLength={DISPLAY_NAME_MAX}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        autoFocus
      />
      <TextField
        label="Last name"
        value={last}
        onChangeText={setLast}
        maxLength={DISPLAY_NAME_MAX}
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (first.trim() !== '') next();
        }}
      />
    </OnboardingScreen>
  );
}
