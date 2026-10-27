import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createPersonalTag, friendlyMessage, searchTags } from '@finalmeal/api';
import type { Tag } from '@finalmeal/api';
import { colors, radii } from '@finalmeal/ui-tokens';
import { splitMatch } from '../../../src/components/CityPicker';
import { Icon } from '../../../src/components/Icon';
import { KeyboardAvoider } from '../../../src/components/KeyboardAvoider';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { TagChip } from '../../../src/components/TagChip';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useAddDish } from '../../../src/state/add-dish';

type Kind = 'food_type' | 'dietary';

const KINDS: { kind: Kind; segment: string; title: string; placeholder: string }[] = [
  { kind: 'food_type', segment: 'Food type', title: 'Add food type', placeholder: 'Search food types' },
  { kind: 'dietary', segment: 'Dietary', title: 'Add dietary', placeholder: 'Search dietary' },
];
const SEARCH_DEBOUNCE_MS = 300;
const POPULAR_LIMIT = 24;
const RESULT_LIMIT = 10;

/** Tag search: find any food-type or dietary tag, or keep an unlisted one as a personal tag. */
export default function TagsSearch() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const { draft, dispatch } = useAddDish();
  const [kind, setKind] = useState<Kind>(params.kind === 'dietary' ? 'dietary' : 'food_type');
  const [query, setQuery] = useState('');
  const [popular, setPopular] = useState<Tag[]>([]);
  const [results, setResults] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = KINDS.find((k) => k.kind === kind) ?? KINDS[0]!;
  const typed = query.trim();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (typed === '') {
          const found = await searchTags(getSupabase(), kind, '', POPULAR_LIMIT);
          if (!cancelled) {
            setPopular(found);
            setResults([]);
            setError(null);
          }
        } else {
          const found = await searchTags(getSupabase(), kind, typed, RESULT_LIMIT);
          if (!cancelled) {
            setResults(found);
            setError(null);
          }
        }
      } catch (e) {
        if (!cancelled) setError(friendlyMessage(e));
      }
    };
    // The Popular list loads straight away; typing waits for a pause.
    const timer = setTimeout(run, typed === '' ? 0 : SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, typed]);

  const chosen = (tag: Tag) => draft.tags.some((t) => t.id === tag.id);

  async function addPersonal() {
    if (busy || typed === '') return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const tag = await createPersonalTag(getSupabase(), typed);
      dispatch({ type: 'selectPersonalTag', name: tag.name });
      setNotice(`Added “${tag.name}” to Your tags.`);
      setQuery('');
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoider>
        <ScreenHeader
          title={current.title}
          onBack={() => router.back()}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Text style={styles.done}>Done</Text>
            </Pressable>
          }
        />
        <View style={styles.segmentWrap}>
          <View style={styles.segments}>
            {KINDS.map(({ kind: k, segment }) => {
              const on = k === kind;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityLabel={segment}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setKind(k);
                    setNotice(null);
                  }}
                  style={[styles.segment, on && styles.segmentOn]}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{segment}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.searchWrap}>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.smoke} />
            <TextInput
              accessibilityLabel={current.placeholder}
              placeholder={current.placeholder}
              placeholderTextColor={colors.dim}
              selectionColor={colors.emberGlow}
              value={query}
              onChangeText={(next) => {
                setQuery(next);
                setNotice(null);
              }}
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          {typed === '' ? (
            <View style={styles.popular}>
              <Text style={styles.label}>Popular</Text>
              <View style={styles.chips}>
                {popular.map((tag) => (
                  <TagChip
                    key={tag.id}
                    label={tag.name}
                    selected={chosen(tag)}
                    onPress={() => dispatch({ type: 'toggleTag', tag })}
                  />
                ))}
              </View>
            </View>
          ) : (
            <>
              <View>
                {results.map((tag) => {
                  const on = chosen(tag);
                  const [match, rest] = splitMatch(tag.name, typed);
                  return (
                    <View key={tag.id} style={styles.result}>
                      <Text style={styles.resultText}>
                        {match ? <Text style={styles.match}>{match}</Text> : null}
                        {rest}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${tag.name}`}
                        accessibilityState={{ selected: on }}
                        onPress={() => dispatch({ type: 'toggleTag', tag })}
                        style={[styles.toggle, on && styles.toggleOn]}
                      >
                        <Icon
                          name={on ? 'check' : 'plus'}
                          size={16}
                          color={on ? colors.white : colors.smoke}
                          strokeWidth={2.5}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Not here? Add “${typed}” to Your tags instead`}
                accessibilityState={{ busy }}
                onPress={addPersonal}
                style={styles.footer}
              >
                <Icon name="tag" size={16} color={colors.emberGlow} />
                <Text style={styles.footerText}>
                  Not here? Add <Text style={styles.footerStrong}>“{typed}”</Text> to{' '}
                  <Text style={styles.footerStrong}>Your tags</Text> instead
                </Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  flex: { flex: 1 },
  done: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.emberGlow, padding: 8 },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 4 },
  segments: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radii.input,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segment: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.ashRaised },
  segmentText: { fontFamily: fontFamily.uiBold, fontSize: 13, color: colors.smoke },
  segmentTextOn: { color: colors.bone },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.emberGlow,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: fontFamily.uiMedium,
    fontSize: 16,
    color: colors.bone,
  },
  content: { gap: 20, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
  notice: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.smoke },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
  label: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  popular: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  resultText: { flex: 1, fontFamily: fontFamily.uiSemiBold, fontSize: 15, color: colors.bone },
  match: { fontFamily: fontFamily.uiBold },
  toggle: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.ember, borderColor: colors.ember },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 14, color: colors.smoke },
  footerStrong: { fontFamily: fontFamily.uiBold, color: colors.bone },
});
