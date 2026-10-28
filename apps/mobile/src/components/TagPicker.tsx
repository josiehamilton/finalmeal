import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';
import { createPersonalTag, friendlyMessage, searchTags } from '@finalmeal/api';
import type { Tag, TagKind } from '@finalmeal/api';
import { colors, radii } from '@finalmeal/ui-tokens';
import { TAG_NAME_MAX } from '@finalmeal/core';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { personalKey } from '../state/add-dish';
import { Icon } from './Icon';
import { TagChip } from './TagChip';

/** How many suggested chips each group shows before More (the AddDishTags board's density). */
export const SUGGESTED_FOOD_TYPES = 5;
export const SUGGESTED_DIETARY = 7;

interface TagPickerProps {
  /** The chosen food-type and dietary tags. */
  tags: Tag[];
  /** The chosen personal tags, by name. */
  personalTags: string[];
  onToggleTag: (tag: Tag) => void;
  onTogglePersonal: (name: string) => void;
  /** A personal tag was just made: select it. */
  onSelectPersonal: (name: string) => void;
  /** Opens tag search for a kind ("More"). */
  onMore: (kind: 'food_type' | 'dietary') => void;
  onHide: () => void;
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHint}>{hint}</Text>
      </View>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/** The expanded "Add tags" panel: suggested food types, dietary tags, and the person's own tags. */
export function TagPicker({
  tags,
  personalTags,
  onToggleTag,
  onTogglePersonal,
  onSelectPersonal,
  onMore,
  onHide,
}: TagPickerProps) {
  const [featured, setFeatured] = useState<Record<TagKind, Tag[]>>({
    food_type: [],
    dietary: [],
    personal: [],
  });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const kinds: TagKind[] = ['food_type', 'dietary', 'personal'];
    // A list that cannot load is just empty: the person can still use More or Your own.
    void Promise.all(
      kinds.map((kind) => searchTags(getSupabase(), kind, '').catch((): Tag[] => [])),
    ).then(([food_type, dietary, personal]) => {
      if (!cancelled) setFeatured({ food_type: food_type ?? [], dietary: dietary ?? [], personal: personal ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** The featured tags, plus any chosen from tag search (so they can be unchosen here). */
  function withChosen(kind: 'food_type' | 'dietary'): Tag[] {
    const list = featured[kind].slice(
      0,
      kind === 'food_type' ? SUGGESTED_FOOD_TYPES : SUGGESTED_DIETARY,
    );
    const extra = tags.filter((t) => t.kind === kind && !list.some((f) => f.id === t.id));
    return [...list, ...extra];
  }

  const personalNames = [...featured.personal.map((t) => t.name)];
  for (const chosen of personalTags) {
    if (!personalNames.some((n) => personalKey(n) === personalKey(chosen))) personalNames.push(chosen);
  }
  const isChosen = (n: string) => personalTags.some((p) => personalKey(p) === personalKey(n));

  async function addOwn() {
    const typed = name.trim();
    if (typed === '' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const tag = await createPersonalTag(getSupabase(), typed);
      onSelectPersonal(tag.name);
      setName('');
      setNaming(false);
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hide"
        onPress={onHide}
        style={styles.head}
      >
        <Icon name="tag" size={18} color={colors.emberGlow} />
        <Text style={styles.headTitle}>
          Tags <Text style={styles.headOptional}>· optional</Text>
        </Text>
        <Text style={styles.hide}>Hide</Text>
        <Icon name="chevUp" size={16} color={colors.smoke} />
      </Pressable>

      <Section title="Food type" hint="Suggested">
        {withChosen('food_type').map((tag) => (
          <TagChip
            key={tag.id}
            label={tag.name}
            selected={tags.some((t) => t.id === tag.id)}
            onPress={() => onToggleTag(tag)}
          />
        ))}
        <TagChip label="More" variant="more" onPress={() => onMore('food_type')} />
      </Section>

      <Section title="Dietary" hint="Any that apply">
        {withChosen('dietary').map((tag) => (
          <TagChip
            key={tag.id}
            label={tag.name}
            selected={tags.some((t) => t.id === tag.id)}
            onPress={() => onToggleTag(tag)}
          />
        ))}
        <TagChip label="More" variant="more" onPress={() => onMore('dietary')} />
      </Section>

      <Section title="Your tags" hint="Just for you">
        {personalNames.map((n) => (
          <TagChip key={personalKey(n)} label={n} selected={isChosen(n)} onPress={() => onTogglePersonal(n)} />
        ))}
        {naming ? null : <TagChip label="Your own" variant="own" onPress={() => setNaming(true)} />}
      </Section>

      {naming ? (
        <View style={styles.naming}>
          <View style={styles.nameBox}>
            <TextInput
              accessibilityLabel="Name your tag"
              placeholder="Name your tag"
              placeholderTextColor={colors.dim}
              selectionColor={colors.emberGlow}
              value={name}
              onChangeText={setName}
              maxLength={TAG_NAME_MAX}
              autoFocus
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={addOwn}
              style={styles.nameInput}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add tag"
            accessibilityState={{ disabled: name.trim() === '' || busy }}
            disabled={name.trim() === '' || busy}
            onPress={addOwn}
            style={[styles.addTag, (name.trim() === '' || busy) && styles.addTagOff]}
          >
            <Text style={styles.addTagText}>Add</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { flex: 1, fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  headOptional: { fontFamily: fontFamily.uiMedium, color: colors.smoke },
  hide: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.smoke },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  sectionHint: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.dim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  naming: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nameBox: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.ash,
  },
  nameInput: { padding: 0, fontFamily: fontFamily.uiMedium, fontSize: 15, color: colors.bone },
  addTag: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radii.input,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTagOff: { opacity: 0.4 },
  addTagText: { fontFamily: fontFamily.uiBold, fontSize: 14, color: colors.white },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
