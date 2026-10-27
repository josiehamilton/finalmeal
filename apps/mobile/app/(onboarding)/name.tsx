import { useRouter } from 'expo-router';
import { useState } from 'react';
import { DISPLAY_NAME_MAX } from '@finalmeal/core';
import { OnboardingScreen } from '../../src/components/OnboardingScreen';
import { TextField } from '../../src/components/TextField';

/** Step 3. The name travels to step 4 in the route; the profile is created there. */
export default function NameStep() {
  const router = useRouter();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  function next() {
    const displayName = `${first.trim()} ${last.trim()}`.trim().slice(0, DISPLAY_NAME_MAX).trim();
    router.push(`/username?name=${encodeURIComponent(displayName)}`);
  }

  return (
    <OnboardingScreen
      step={3}
      title="What should we call you?"
      subtitle="This shows on your profile and on every pick."
      onBack={() => router.back()}
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
