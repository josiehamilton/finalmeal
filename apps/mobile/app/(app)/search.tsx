import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  friendlyMessage,
  getCity,
  getSuggestedPeople,
  searchDishes,
  searchPeople,
  searchPlaces,
} from '@finalmeal/api';
import type {
  DiscoverDish,
  LatLng,
  PersonSearchRow,
  Place,
  PlaceHit,
  SuggestedPerson,
} from '@finalmeal/api';
import { followersLabel } from '@finalmeal/core';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { DishResultRow } from '../../src/components/DishResultRow';
import { Icon } from '../../src/components/Icon';
import { PersonRow } from '../../src/components/PersonRow';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SEARCH_DEBOUNCE_MS } from '../../src/components/SearchField';
import { SpotResultRow } from '../../src/components/SpotResultRow';
import { fontFamily } from '../../src/lib/fonts';
import { getSupabase } from '../../src/lib/supabase';
import { useSession } from '../../src/providers/SessionProvider';
import { syncFollowStates } from '../../src/state/follow-store';

type Tab = 'people' | 'dishes' | 'spots';
const TABS: { tab: Tab; label: string }[] = [
  { tab: 'people', label: 'People' },
  { tab: 'dishes', label: 'Dishes' },
  { tab: 'spots', label: 'Spots' },
];

/** Rows per kind: a full list in the Feed's tabs, a short preview in each Discover section. */
const FEED_LIMIT = 20;
const DISCOVER_DISHES = 5;
const DISCOVER_SPOTS = 5;
const DISCOVER_PEOPLE = 3;
const SUGGESTED_WITH_TEXT = 5;

interface Results {
  dishes: DiscoverDish[];
  spots: PlaceHit[];
  found: PersonSearchRow[];
  suggested: SuggestedPerson[];
}
const NONE: Results = { dishes: [], spots: [], found: [], suggested: [] };

function pointFrom(lat?: string, lng?: string): LatLng | undefined {
  const la = parseFloat(lat ?? '');
  const ln = parseFloat(lng ?? '');
  return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : undefined;
}

/** "#1 · Plain Biryani" for a suggested person with a number one dish; the handle otherwise. */
function topDishLine(person: SuggestedPerson): string | undefined {
  return person.topDish ? `#1 · ${person.topDish}` : undefined;
}

function Section({ label }: { label: string }) {
  return (
    <Text style={styles.section} accessibilityRole="header">
      {label}
    </Text>
  );
}

/**
 * Search: dishes, spots and people. From the Feed it has People, Dishes and Spots tabs and ranks
 * near the home city; from Discover it shows short sections and ranks near the map's centre. It
 * never asks where the phone is.
 */
export default function Search() {
  const router = useRouter();
  const { profile } = useSession();
  const params = useLocalSearchParams<{ from?: string; lat?: string; lng?: string }>();
  const discover = params.from === 'discover';
  const homeId = profile?.homeCity?.id ?? null;

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [tab, setTab] = useState<Tab>('people');
  const [tries, setTries] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Results>(NONE);

  // Where results rank from: Discover's centre, or the home city's point. Never the phone.
  const centre = useMemo(() => pointFrom(params.lat, params.lng), [params.lat, params.lng]);
  const [homePoint, setHomePoint] = useState<LatLng | undefined>(undefined);
  const [homeReady, setHomeReady] = useState(discover || homeId === null);
  useEffect(() => {
    if (discover || homeId === null) return;
    let cancelled = false;
    getCity(getSupabase(), homeId).then(
      (city) => {
        if (cancelled) return;
        setHomePoint(city ? { lat: city.lat, lng: city.lng } : undefined);
        setHomeReady(true);
      },
      () => {
        if (!cancelled) setHomeReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [discover, homeId]);
  const near = discover ? centre : homePoint;
  // People never uses the point, so it neither waits for the home city nor reloads when it arrives.
  const usesNear = discover || tab !== 'people';
  const rankNear = usesNear ? near : undefined;
  const ready = !usesNear || homeReady;

  useEffect(() => {
    const timer = setTimeout(
      () => setQuery(text.trim().replace(/^@+/, '').trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [text]);

  // Only the newest request may set the results: changing anything cancels the one before.
  useEffect(() => {
    if (!ready) {
      setStatus('loading');
      return;
    }
    const peopleTab = !discover && tab === 'people';
    if (query === '' && !peopleTab) {
      setResults(NONE);
      setError(null);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    const client = getSupabase();
    setStatus('loading');
    setError(null);
    setResults(NONE);
    const load = async (): Promise<Results> => {
      if (discover) {
        const [dishes, spots, found] = await Promise.all([
          searchDishes(client, query, rankNear, DISCOVER_DISHES),
          searchPlaces(client, query, rankNear, DISCOVER_SPOTS),
          searchPeople(client, query, DISCOVER_PEOPLE),
        ]);
        return { dishes, spots, found, suggested: [] };
      }
      if (tab === 'dishes') {
        return { ...NONE, dishes: await searchDishes(client, query, rankNear, FEED_LIMIT) };
      }
      if (tab === 'spots') {
        return { ...NONE, spots: await searchPlaces(client, query, rankNear, FEED_LIMIT) };
      }
      if (query === '') return { ...NONE, suggested: await getSuggestedPeople(client, FEED_LIMIT) };
      const [found, suggested] = await Promise.all([
        searchPeople(client, query, FEED_LIMIT),
        getSuggestedPeople(client, SUGGESTED_WITH_TEXT),
      ]);
      return { ...NONE, found, suggested };
    };
    load().then(
      (next) => {
        if (cancelled) return;
        syncFollowStates([...next.found, ...next.suggested]);
        setResults(next);
        setStatus('ready');
      },
      (e) => {
        if (cancelled) return;
        setError(friendlyMessage(e));
        setStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, tab, discover, rankNear, ready, tries]);

  function openPlace(place: Place) {
    router.navigate({
      pathname: '/discover',
      params: { placeId: place.id, lat: place.lat, lng: place.lng },
    });
  }

  function openDish(dish: DiscoverDish) {
    if (dish.pickId) router.push(`/pick/${dish.pickId}`);
    else openPlace(dish.place);
  }

  const openPerson = (id: string) => router.push(`/u/${id}`);

  const found = results.found;
  const foundIds = new Set(found.map((p) => p.id));
  const suggested = results.suggested.filter((p) => !foundIds.has(p.id));
  const searching = query !== '';

  const personRows = (people: readonly PersonSearchRow[]) =>
    people.map((p) => (
      <PersonRow
        key={p.id}
        person={p}
        avatarSize={46}
        subtitle={`@${p.username} · ${followersLabel(p.followersCount)}`}
        onOpen={openPerson}
      />
    ));
  const dishRows = results.dishes.map((d) => (
    <DishResultRow key={d.dishId + d.place.id} dish={d} onPress={openDish} />
  ));
  const spotRows = results.spots.map((p) => (
    <SpotResultRow key={p.id} place={p} distanceM={p.distanceM} onPress={openPlace} />
  ));
  const suggestedBlock =
    suggested.length > 0 ? (
      <>
        <Section label="Suggested for you" />
        {suggested.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            avatarSize={46}
            subtitle={topDishLine(p)}
            onOpen={openPerson}
          />
        ))}
      </>
    ) : null;

  const noMatches = <Text style={styles.empty}>{`No matches for “${query}”.`}</Text>;

  let body: React.ReactNode = null;
  if (status === 'error') {
    body = (
      <View style={styles.problemBox}>
        <Text style={styles.problem} accessibilityRole="alert">
          {error}
        </Text>
        <PrimaryButton label="Try again" onPress={() => setTries((n) => n + 1)} />
      </View>
    );
  } else if (status === 'loading') {
    body = (
      <ActivityIndicator testID="search-loading" color={colors.emberGlow} style={styles.spinner} />
    );
  } else if (discover) {
    const empty = results.dishes.length + results.spots.length + found.length === 0;
    body = !searching ? (
      <Text style={styles.empty}>Search dishes, spots and people.</Text>
    ) : empty ? (
      noMatches
    ) : (
      <>
        {dishRows.length > 0 ? <Section label="Dishes" /> : null}
        {dishRows}
        {spotRows.length > 0 ? <Section label="Spots" /> : null}
        {spotRows}
        {found.length > 0 ? <Section label="People" /> : null}
        {personRows(found)}
      </>
    );
  } else if (tab === 'people') {
    body = (
      <>
        {searching && found.length === 0 ? noMatches : null}
        {personRows(found)}
        {suggestedBlock}
        {!searching && suggested.length === 0 ? (
          <Text style={styles.empty}>
            No suggestions yet. Search for a friend by name or @handle.
          </Text>
        ) : null}
      </>
    );
  } else if (!searching) {
    body = <Text style={styles.empty}>Search dishes, spots and people.</Text>;
  } else {
    const rows = tab === 'dishes' ? dishRows : spotRows;
    body = rows.length === 0 ? noMatches : <>{rows}</>;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.top}>
        <View style={[styles.field, focused && styles.fieldFocused]}>
          <Icon name="search" size={18} color={colors.smoke} />
          <TextInput
            accessibilityLabel="Search"
            placeholder="Dishes, spots, people"
            placeholderTextColor={colors.dim}
            selectionColor={colors.emberGlow}
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          {text !== '' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear"
              hitSlop={8}
              onPress={() => setText('')}
            >
              <Icon name="close" size={18} color={colors.smoke} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={() => router.back()}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>
      {!discover ? (
        <View style={styles.tabs} accessibilityRole="tablist">
          {TABS.map(({ tab: id, label }) => {
            const on = id === tab;
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: on }}
                onPress={() => setTab(id)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.ash,
  },
  fieldFocused: { borderColor: colors.emberGlow },
  input: { flex: 1, fontFamily: fontFamily.uiMedium, fontSize: 16, color: colors.bone, padding: 0 },
  cancel: { fontFamily: fontFamily.uiSemiBold, fontSize: 15, color: colors.bone },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: { borderBottomColor: colors.emberGlow },
  tabLabel: { fontFamily: fontFamily.uiBold, fontSize: 14, color: colors.dim },
  tabLabelOn: { color: colors.bone },
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
  spinner: { paddingTop: 32 },
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
