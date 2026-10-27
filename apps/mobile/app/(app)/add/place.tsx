import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@finalmeal/ui-tokens';
import { KeyboardAvoider } from '../../../src/components/KeyboardAvoider';
import { PlaceSearch } from '../../../src/components/PlaceSearch';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { useSession } from '../../../src/providers/SessionProvider';
import { useAddDish } from '../../../src/state/add-dish';

/** Choose a restaurant: search around a chosen city (the home city to start with). */
export default function ChooseRestaurant() {
  const router = useRouter();
  const { profile } = useSession();
  const { draft, dispatch } = useAddDish();
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoider>
        <ScreenHeader title="Choose a restaurant" onBack={() => router.back()} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PlaceSearch
            homeCity={profile?.homeCity ?? null}
            city={draft.searchCity}
            onCityChange={(city) => dispatch({ type: 'setSearchCity', city })}
            onChoose={(place) => {
              dispatch({ type: 'setPlace', place });
              router.back();
            }}
            onAddNew={(typed) =>
              router.push({ pathname: '/add/custom-place', params: { name: typed } })
            }
          />
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  flex: { flex: 1 },
  content: { gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
});
