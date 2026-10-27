import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Circle, Path } from 'react-native-svg';
import { friendlyMessage, nearestCity, searchCities } from '@finalmeal/api';
import type { City } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { TextField } from './TextField';

const SEARCH_DEBOUNCE_MS = 250;
const RESULT_LIMIT = 6;
const LOCATION_DECLINED = 'No problem. Search for your city instead.';

/** Splits a label into the part the person typed and the rest, ignoring case and outer spaces. */
export function splitMatch(label: string, query: string): [string, string] {
  const typed = query.trim();
  if (typed !== '' && label.toLowerCase().startsWith(typed.toLowerCase())) {
    return [label.slice(0, typed.length), label.slice(typed.length)];
  }
  return ['', label];
}

function PinIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={1.75} />
    </Svg>
  );
}

function LocateIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Circle cx={12} cy={12} r={3} stroke={colors.emberGlow} strokeWidth={1.75} />
      <Circle cx={12} cy={12} r={7} stroke={colors.emberGlow} strokeWidth={1.75} />
      <Path
        d="M12 2v3M12 19v3M2 12h3M19 12h3"
        stroke={colors.emberGlow}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

interface CityPickerProps {
  /** The chosen city, or null while nothing (or something edited) is chosen. */
  onChange: (city: City | null) => void;
}

/** Type-ahead city search plus "Use my current location". */
export function CityPicker({ onChange }: CityPickerProps) {
  const [text, setText] = useState('');
  const [results, setResults] = useState<City[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      latest.current++;
    },
    [],
  );

  function choose(city: City) {
    clearTimeout(timer.current);
    latest.current++;
    setText(city.label);
    setResults([]);
    setError(null);
    setNotice(null);
    onChange(city);
  }

  function handleText(next: string) {
    setText(next);
    setNotice(null);
    setError(null);
    onChange(null);
    clearTimeout(timer.current);
    const request = ++latest.current;
    if (next.trim() === '') {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const found = await searchCities(getSupabase(), next, RESULT_LIMIT);
        if (request === latest.current) setResults(found);
      } catch (e) {
        if (request !== latest.current) return;
        setResults([]);
        setError(friendlyMessage(e));
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  async function useCurrentLocation() {
    if (locating) return;
    setLocating(true);
    setNotice(null);
    setError(null);
    try {
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = position.coords;
        }
      } catch {
        // Location services off, or no fix: the same gentle fallback as a "no".
      }
      if (!coords) {
        setNotice(LOCATION_DECLINED);
        return;
      }
      const city = await nearestCity(getSupabase(), coords.latitude, coords.longitude);
      if (city) choose(city);
      else setNotice(LOCATION_DECLINED);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.search}>
        <TextField
          label="City"
          placeholder="Search your city"
          value={text}
          onChangeText={handleText}
          error={error}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
        />
        {results.length > 0 ? (
          <View>
            {results.map((city) => {
              const [typed, rest] = splitMatch(city.label, text);
              return (
                <Pressable
                  key={city.id}
                  accessibilityRole="button"
                  accessibilityLabel={city.label}
                  onPress={() => choose(city)}
                  style={styles.result}
                >
                  <PinIcon color={colors.smoke} />
                  <Text style={styles.resultText}>
                    {typed ? <Text style={styles.typed}>{typed}</Text> : null}
                    {rest}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use my current location"
        accessibilityState={{ busy: locating }}
        onPress={useCurrentLocation}
        style={styles.locate}
      >
        <LocateIcon />
        <Text style={styles.locateText}>Use my current location</Text>
      </Pressable>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  search: { gap: 4 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  resultText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 15, color: colors.bone },
  typed: { fontFamily: fontFamily.uiBold },
  locate: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  locateText: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.emberGlow },
  notice: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.smoke },
});
