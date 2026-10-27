import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createCustomPlace, friendlyMessage } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { PLACE_ADDRESS_MAX, PLACE_NAME_MAX } from '@finalmeal/core';
import { Checkbox } from '../../../src/components/Checkbox';
import { CityPicker } from '../../../src/components/CityPicker';
import { OnboardingScreen } from '../../../src/components/OnboardingScreen';
import { TextField } from '../../../src/components/TextField';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useSession } from '../../../src/providers/SessionProvider';
import { useAddDish } from '../../../src/state/add-dish';

const INTRO =
  'Restaurants, cafés, food trucks and pop-ups: anywhere the public can eat. Please don’t add someone’s home.';

/** Add a spot: a public business that is not in the place data. It takes an address, never a map pin. */
export default function CustomPlace() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const { profile } = useSession();
  const { draft, dispatch } = useAddDish();
  const start = draft.searchCity ?? profile?.homeCity ?? null;

  const [name, setName] = useState(typeof params.name === 'string' ? params.name : '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState<{ id: string; label: string } | null>(
    start ? { id: start.id, label: start.label } : null,
  );
  const [noFixedAddress, setNoFixedAddress] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    name.trim() !== '' &&
    city !== null &&
    (noFixedAddress || address.trim() !== '') &&
    isPublic;

  async function submit() {
    if (!ready || busy || !city) return;
    setBusy(true);
    setError(null);
    try {
      const place = await createCustomPlace(getSupabase(), {
        name: name.trim(),
        cityId: city.id,
        address: noFixedAddress ? undefined : address.trim(),
        noFixedAddress,
      });
      dispatch({ type: 'setPlace', place });
      router.dismissTo('/add');
    } catch (e) {
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <OnboardingScreen
      title="Add a spot"
      subtitle={INTRO}
      onBack={() => router.back()}
      cta={{ label: 'Add spot', onPress: submit, disabled: !ready, busy }}
    >
      <View style={styles.fields}>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={PLACE_NAME_MAX}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextField
          label="Street address"
          placeholder="123 Main St"
          value={address}
          onChangeText={setAddress}
          editable={!noFixedAddress}
          maxLength={PLACE_ADDRESS_MAX}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Checkbox
          label="No fixed address (food truck or pop-up)"
          checked={noFixedAddress}
          onChange={(next) => {
            setNoFixedAddress(next);
            if (next) setAddress('');
          }}
        />
        <CityPicker
          initialLabel={start?.label}
          allowCurrentLocation={false}
          onChange={(next) => setCity(next ? { id: next.id, label: next.label } : null)}
        />
        <Checkbox label="This spot is open to the public" checked={isPublic} onChange={setIsPublic} />
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 20 },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
