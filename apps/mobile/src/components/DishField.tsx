import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { suggestDishes } from '@finalmeal/api';
import type { DishSuggestion } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { DISH_NAME_MAX } from '@finalmeal/core';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { suggestionLabel } from '../state/add-dish';
import { TextField } from './TextField';

const SUGGEST_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 6;

interface DishFieldProps {
  value: string;
  /** The chosen restaurant; suggestions are the dishes already known there. */
  placeId: string | null;
  onChangeText: (text: string) => void;
  onChoose: (suggestion: DishSuggestion) => void;
}

/** The Dish field: once a restaurant is chosen, typing lists dishes already logged there. */
export function DishField({ value, placeId, onChangeText, onChoose }: DishFieldProps) {
  const [suggestions, setSuggestions] = useState<DishSuggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      latest.current++;
    },
    [],
  );

  function handleText(next: string) {
    onChangeText(next);
    clearTimeout(timer.current);
    const request = ++latest.current;
    if (!placeId || next.trim() === '') {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const found = await suggestDishes(getSupabase(), placeId, next);
        if (request === latest.current) setSuggestions(found.slice(0, SUGGESTION_LIMIT));
      } catch {
        // Suggestions are a convenience: without them the person just types the dish.
        if (request === latest.current) setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
  }

  function choose(suggestion: DishSuggestion) {
    clearTimeout(timer.current);
    latest.current++;
    setSuggestions([]);
    onChoose(suggestion);
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label="Dish"
        placeholder="e.g. Smash Burger"
        value={value}
        onChangeText={handleText}
        maxLength={DISH_NAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
      />
      {suggestions.length > 0 ? (
        <View>
          {suggestions.map((s) => {
            const label = suggestionLabel(s);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => choose(s)}
                style={styles.row}
              >
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                  {label !== s.name ? (
                    <Text style={styles.count}>{label.slice(s.name.length)}</Text>
                  ) : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  name: { fontFamily: fontFamily.uiSemiBold, fontSize: 15, color: colors.bone },
  count: { fontFamily: fontFamily.ui, color: colors.smoke },
});
