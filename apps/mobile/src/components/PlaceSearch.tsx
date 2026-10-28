import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage, getCity, getPopularPlaces, searchPlaces } from '@finalmeal/api';
import type { City, Place } from '@finalmeal/api';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import type { SearchCity } from '../state/add-dish';
import { CityPicker } from './CityPicker';
import { Icon } from './Icon';
import { TextField } from './TextField';

const SEARCH_DEBOUNCE_MS = 300;
const RESULT_LIMIT = 12;

interface PlaceSearchProps {
  /** The person's home city: the starting point until they choose another. */
  homeCity: { id: string; label: string } | null;
  /** The city the search is anchored to (kept by the caller, so it survives leaving the screen). */
  city: SearchCity | null;
  onCityChange: (city: SearchCity) => void;
  onChoose: (place: Place) => void;
  /** "Can’t find it? Add it", with whatever has been typed. */
  onAddNew: (typed: string) => void;
}

/** A city's point, used only to rank results around it. A failed lookup just means no ranking. */
async function pointOf(id: string): Promise<SearchCity['point']> {
  try {
    const found = await getCity(getSupabase(), id);
    return found ? { lat: found.lat, lng: found.lng } : null;
  } catch {
    return null;
  }
}

/**
 * Restaurant type-ahead for a chosen city (never the phone's location: Final Meal is a post-meal
 * diary, so people log dishes from trips after they are home). Typing searches places, ranked
 * around the city's point. An empty field lists that city's most-picked spots (`getPopularPlaces`,
 * keyed by the city's id); without a city there is nothing to list yet.
 */
export function PlaceSearch({ homeCity, city, onCityChange, onChoose, onAddNew }: PlaceSearchProps) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const onCityChangeRef = useRef(onCityChange);
  onCityChangeRef.current = onCityChange;

  const hasCity = city !== null;
  const homeId = homeCity?.id;
  const homeLabel = homeCity?.label;
  useEffect(() => {
    if (hasCity || !homeId || homeLabel === undefined) return;
    let cancelled = false;
    void pointOf(homeId).then((point) => {
      if (!cancelled) onCityChangeRef.current({ id: homeId, label: homeLabel, point });
    });
    return () => {
      cancelled = true;
    };
  }, [hasCity, homeId, homeLabel]);

  const cityId = city?.id;
  const lat = city?.point?.lat;
  const lng = city?.point?.lng;
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        let found: Place[] = [];
        if (text.trim() === '') {
          if (cityId) found = await getPopularPlaces(getSupabase(), cityId, RESULT_LIMIT);
        } else {
          const point = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
          found = await searchPlaces(getSupabase(), text, point, RESULT_LIMIT);
        }
        if (cancelled) return;
        setResults(found);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setResults([]);
        setError(friendlyMessage(e));
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, cityId, lat, lng]);

  async function chooseCity(next: City | null) {
    if (!next) return;
    setChanging(false);
    const point = await pointOf(next.id);
    onCityChange({ id: next.id, label: next.label, point });
  }

  const cityLabel = city?.label;
  return (
    <View style={styles.wrap}>
      <TextField
        label="Restaurant"
        placeholder="Search restaurants"
        value={text}
        onChangeText={setText}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
      />

      {cityLabel !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`In ${cityLabel} · Change`}
          onPress={() => setChanging((open) => !open)}
          hitSlop={6}
          style={styles.chip}
        >
          <Icon name="pin" size={16} color={colors.emberGlow} />
          <Text style={styles.chipText}>
            In {cityLabel} · <Text style={styles.chipChange}>Change</Text>
          </Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a city"
          onPress={() => setChanging((open) => !open)}
          hitSlop={6}
          style={styles.chip}
        >
          <Icon name="pin" size={16} color={colors.emberGlow} />
          <Text style={[styles.chipText, styles.chipChange]}>Choose a city</Text>
        </Pressable>
      )}

      {changing ? (
        <View style={styles.picker}>
          <CityPicker onChange={chooseCity} />
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View>
        {results.map((place) => (
          <Pressable
            key={place.id}
            accessibilityRole="button"
            accessibilityLabel={`${place.name}, ${place.label}`}
            onPress={() => onChoose(place)}
            style={styles.result}
          >
            <Icon name="pin" size={18} color={colors.smoke} />
            <View style={styles.resultBody}>
              <Text style={styles.name} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.where} numberOfLines={1}>
                {place.label}
              </Text>
            </View>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Can’t find it? Add it"
          onPress={() => onAddNew(text.trim())}
          style={styles.result}
        >
          <Icon name="plus" size={18} color={colors.emberGlow} />
          <Text style={styles.addNew}>Can’t find it? Add it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  chipText: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.smoke },
  chipChange: { fontFamily: fontFamily.uiBold, color: colors.emberGlow },
  picker: {
    padding: 14,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.ash,
  },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  resultBody: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  where: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  addNew: { flex: 1, fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.emberGlow },
});
