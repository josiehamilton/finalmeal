import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { getPicksInView, searchTags } from '@finalmeal/api';
import type { Tag } from '@finalmeal/api';
import {
  DEFAULT_DISCOVER_FILTERS,
  RADIUS_SLIDER_MAX,
  radiusFromSlider,
  radiusLabel,
  sliderFromRadius,
} from '@finalmeal/core';
import type { DiscoverFilters, DiscoverTier } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import type { MapRegion } from '../map/bridge';
import { Icon } from './Icon';
import { TagChip } from './TagChip';

/** The Popular tags shown before More. */
const POPULAR = 8;
/** How many tags a search shows. */
const SEARCH_RESULTS = 10;
/** How long to wait after the last change before counting, or after the last keystroke before searching. */
export const FILTERS_DEBOUNCE_MS = 300;

const TIERS: { tier: DiscoverTier; label: string }[] = [
  { tier: 'all', label: 'All' },
  { tier: 'final', label: 'Final Meals' },
  { tier: 'honorable', label: 'Honorable' },
];

type Kind = 'food_type' | 'dietary';

const KINDS: { kind: Kind; title: string; search: string; ids: 'foodTypeIds' | 'dietaryIds' }[] = [
  { kind: 'food_type', title: 'Food type', search: 'Search food types', ids: 'foodTypeIds' },
  { kind: 'dietary', title: 'Dietary', search: 'Search dietary', ids: 'dietaryIds' },
];

/** `Show 9 picks`, `Show 1 pick`, `No picks match`; plain `Show picks` while there is no count. */
export function showLabel(count: number | null): string {
  if (count === null) return 'Show picks';
  if (count === 0) return 'No picks match';
  return `Show ${count} ${count === 1 ? 'pick' : 'picks'}`;
}

interface FiltersSheetProps {
  visible: boolean;
  filters: DiscoverFilters;
  /** What the count is taken over: the map's current view. */
  region: MapRegion | null;
  onApply: (filters: DiscoverFilters) => void;
  /** Closing without applying: the draft is thrown away. */
  onClose: () => void;
}

/**
 * The Filters sheet: Pick type, Distance, Food type and Dietary, edited as a draft. `Show n picks`
 * applies the draft; the backdrop, a swipe down and the system back gesture throw it away.
 */
export function FiltersSheet({ visible, filters, region, onApply, onClose }: FiltersSheetProps) {
  const [popular, setPopular] = useState<Record<Kind, Tag[]>>({ food_type: [], dietary: [] });
  /** Every tag seen so far, so a chosen id can be shown by name after the list changes. */
  const known = useRef(new Map<string, Tag>());
  const loaded = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The Popular lists load the first time the sheet opens, and are kept for the next time.
  useEffect(() => {
    if (!visible || loaded.current) return;
    loaded.current = true;
    void Promise.all(
      KINDS.map(({ kind }) => searchTags(getSupabase(), kind, '').catch((): Tag[] => [])),
    ).then(([food, dietary]) => {
      if (!mounted.current) return;
      // Offline on the first open: ask again the next time it opens.
      if ((food ?? []).length === 0 && (dietary ?? []).length === 0) loaded.current = false;
      for (const tag of [...(food ?? []), ...(dietary ?? [])]) known.current.set(tag.id, tag);
      setPopular({ food_type: (food ?? []).slice(0, POPULAR), dietary: (dietary ?? []).slice(0, POPULAR) });
    });
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <FiltersBody
        filters={filters}
        region={region}
        popular={popular}
        known={known.current}
        onApply={onApply}
        onClose={onClose}
      />
    </Modal>
  );
}

interface BodyProps {
  filters: DiscoverFilters;
  region: MapRegion | null;
  popular: Record<Kind, Tag[]>;
  known: Map<string, Tag>;
  onApply: (filters: DiscoverFilters) => void;
  onClose: () => void;
}

function FiltersBody({ filters, region, popular, known, onApply, onClose }: BodyProps) {
  const [draft, setDraft] = useState<DiscoverFilters>(filters);
  const [count, setCount] = useState<number | null>(null);

  // The grab area at the top of the sheet: a swipe down closes it, like the backdrop.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 80 || g.vy > 0.8) closeRef.current();
      },
    }),
  ).current;

  // How many picks the draft would show, counted after the draft stops changing.
  useEffect(() => {
    if (!region) return;
    let current = true;
    const timer = setTimeout(() => {
      getPicksInView(getSupabase(), region.bounds, draft, region.center).then(
        ({ places }) => {
          if (current) setCount(places.reduce((sum, p) => sum + p.pickCount, 0));
        },
        () => {
          if (current) setCount(null);
        },
      );
    }, FILTERS_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [draft, region]);

  function toggleTag(ids: 'foodTypeIds' | 'dietaryIds', tag: Tag) {
    known.set(tag.id, tag);
    setDraft((d) => ({
      ...d,
      [ids]: d[ids].includes(tag.id) ? d[ids].filter((id) => id !== tag.id) : [...d[ids], tag.id],
    }));
  }

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close filters"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View style={styles.sheet}>
        <View {...pan.panHandlers} style={styles.grab}>
          <View accessible={false} style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Filters
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset"
              onPress={() =>
                setDraft((d) => ({ ...DEFAULT_DISCOVER_FILTERS, followingOnly: d.followingOnly }))
              }
              hitSlop={8}
            >
              <Text style={styles.reset}>Reset</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.label} accessibilityRole="header">Pick type</Text>
            <View style={styles.chips}>
              {TIERS.map(({ tier, label }) => (
                <TagChip
                  key={tier}
                  label={label}
                  selected={draft.tier === tier}
                  onPress={() => setDraft((d) => ({ ...d, tier }))}
                />
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label} accessibilityRole="header">Distance</Text>
              <Text style={styles.distance}>{radiusLabel(draft.radiusKm)}</Text>
            </View>
            <Slider
              accessibilityLabel="Distance in kilometres"
              accessibilityValue={{ text: radiusLabel(draft.radiusKm) }}
              minimumValue={1}
              maximumValue={RADIUS_SLIDER_MAX}
              step={1}
              value={sliderFromRadius(draft.radiusKm)}
              minimumTrackTintColor={colors.ember}
              maximumTrackTintColor={colors.lineStrong}
              thumbTintColor={colors.bone}
              onValueChange={(v) => setDraft((d) => ({ ...d, radiusKm: radiusFromSlider(v) }))}
            />
          </View>
          {KINDS.map(({ kind, title, search, ids }) => (
            <TagGroup
              key={kind}
              kind={kind}
              title={title}
              searchLabel={search}
              popular={popular[kind]}
              chosen={draft[ids]}
              known={known}
              onToggle={(tag) => toggleTag(ids, tag)}
            />
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showLabel(count)}
          onPress={() => onApply(draft)}
          style={styles.show}
        >
          <Text style={styles.showText}>{showLabel(count)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface TagGroupProps {
  kind: Kind;
  title: string;
  searchLabel: string;
  popular: Tag[];
  chosen: string[];
  known: Map<string, Tag>;
  onToggle: (tag: Tag) => void;
}

/** One tag group: Popular, then the chosen ones that are not in it, then More (a search under the group). */
function TagGroup({ kind, title, searchLabel, popular, chosen, known, onToggle }: TagGroupProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tag[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q === '') {
      setResults([]);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      searchTags(getSupabase(), kind, q, SEARCH_RESULTS).then(
        (tags) => {
          if (!current) return;
          for (const tag of tags) known.set(tag.id, tag);
          setResults(tags);
        },
        () => {
          if (current) setResults([]);
        },
      );
    }, FILTERS_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, kind, known]);

  const shown: Tag[] = [...popular];
  const add = (tag: Tag | undefined) => {
    if (tag && !shown.some((t) => t.id === tag.id)) shown.push(tag);
  };
  for (const id of chosen) add(known.get(id));
  for (const tag of results) add(tag);

  return (
    <View style={styles.section}>
      <Text style={styles.label} accessibilityRole="header">{title}</Text>
      <View style={styles.chips}>
        {shown.map((tag) => (
          <TagChip
            key={tag.id}
            label={tag.name}
            selected={chosen.includes(tag.id)}
            onPress={() => onToggle(tag)}
          />
        ))}
        <TagChip variant="own" label="More" onPress={() => {
            setSearching((s) => !s);
            setQuery('');
          }} />
      </View>
      {searching ? (
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.dim} />
          <TextInput
            autoFocus
            accessibilityLabel={searchLabel}
            placeholder={searchLabel}
            placeholderTextColor={colors.dim}
            selectionColor={colors.emberGlow}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    maxHeight: '92%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 34,
    gap: 24,
    backgroundColor: colors.ash,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  grab: { gap: 14 },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fontFamily.display, fontSize: 30, color: colors.bone },
  reset: { fontFamily: fontFamily.uiSemiBold, fontSize: 14, color: colors.smoke },
  content: { gap: 24 },
  section: { gap: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  distance: { fontFamily: fontFamily.uiBold, fontSize: 14, color: colors.emberGlow },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.ashRaised,
  },
  searchInput: { flex: 1, fontFamily: fontFamily.ui, fontSize: 15, color: colors.bone, padding: 0 },
  show: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showText: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.white },
});
