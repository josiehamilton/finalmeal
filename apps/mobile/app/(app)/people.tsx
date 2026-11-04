import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, getSuggestedPeople, searchPeople } from '@finalmeal/api';
import type { PersonRow as PersonRowData, SuggestedPerson } from '@finalmeal/api';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { PersonRow } from '../../src/components/PersonRow';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SEARCH_DEBOUNCE_MS, SearchField } from '../../src/components/SearchField';
import { cityName } from '../../src/lib/city-name';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { useSession } from '../../src/providers/SessionProvider';
import { syncFollowStates } from '../../src/state/follow-store';

const LIMIT = 20;

/** "#1 · Plain Biryani" for a suggested person with a number one dish; nothing for a search result. */
function topDishLine(person: PersonRowData | SuggestedPerson): string | undefined {
  return 'topDish' in person && person.topDish ? `#1 · ${person.topDish}` : undefined;
}

/** Find people: the popular list near your home city, or the people a search finds. */
export default function People() {
  const router = useRouter();
  const { profile } = useSession();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [suggested, setSuggested] = useState<SuggestedPerson[] | null>(null);
  const [found, setFound] = useState<PersonRowData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const searching = query !== '';

  // The popular list loads once (and again on Try again); a search runs as the query settles.
  useEffect(() => {
    if (searching) return;
    let cancelled = false;
    setError(null);
    getSuggestedPeople(getSupabase(), LIMIT)
      .then((people) => {
        if (cancelled) return;
        syncFollowStates(people);
        setSuggested(people);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [searching, tries]);

  useEffect(() => {
    if (!searching) return;
    let cancelled = false;
    setError(null);
    setFound(null);
    searchPeople(getSupabase(), query, LIMIT)
      .then((people) => {
        if (cancelled) return;
        syncFollowStates(people);
        setFound(people);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [query, searching, tries]);

  const city = profile?.homeCity;
  const heading = city ? `Popular near ${cityName(city.label)}` : 'Popular on Final Meal';
  const rows: readonly PersonRowData[] | null = searching ? found : suggested;

  function openPerson(id: string) {
    router.push(`/u/${id}`);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader title="Find people" onBack={() => router.back()} />
      <View style={styles.search}>
        <SearchField value={text} onChangeText={setText} label="Search people" />
      </View>
      <FlatList<PersonRowData>
        testID="people-list"
        data={rows ?? []}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PersonRow person={item} subtitle={topDishLine(item)} onOpen={openPerson} />
        )}
        ListHeaderComponent={
          !searching && rows && rows.length > 0 ? (
            <Text style={styles.section} accessibilityRole="header">
              {heading}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.problemBox}>
              <Text style={styles.problem} accessibilityRole="alert">
                {error}
              </Text>
              <PrimaryButton label="Try again" onPress={() => setTries((n) => n + 1)} />
            </View>
          ) : rows === null ? (
            <ActivityIndicator testID="people-loading" color={colors.emberGlow} />
          ) : (
            <Text style={styles.empty}>
              {searching
                ? `No one matches “${query}”.`
                : 'No suggestions yet. Search for a friend by name or @handle.'}
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  search: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  section: {
    paddingTop: 16,
    paddingBottom: 4,
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  problem: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 15,
    color: colors.bone,
    textAlign: 'center',
  },
  problemBox: { alignItems: 'center', gap: 20, paddingTop: 32 },
  empty: {
    paddingTop: 32,
    fontFamily: fontFamily.ui,
    fontSize: 15,
    color: colors.smoke,
    textAlign: 'center',
  },
});
