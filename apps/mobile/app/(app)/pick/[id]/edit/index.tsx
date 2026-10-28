import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, friendlyMessage, getMyPicks, updatePick } from '@finalmeal/api';
import type { Pick, PickPatch } from '@finalmeal/api';
import { NOTE_MAX } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { Icon } from '../../../../../src/components/Icon';
import { KeyboardAvoider } from '../../../../../src/components/KeyboardAvoider';
import { PhotoField } from '../../../../../src/components/PhotoField';
import { PrimaryButton } from '../../../../../src/components/PrimaryButton';
import { ScreenHeader } from '../../../../../src/components/ScreenHeader';
import { TagPicker } from '../../../../../src/components/TagPicker';
import { TextField } from '../../../../../src/components/TextField';
import { fontFamily } from '../../../../../src/lib/fonts';
import { preparePickPhoto } from '../../../../../src/lib/prepare-pick-photo';
import { getSupabase } from '../../../../../src/lib/supabase';
import { useBlockBack } from '../../../../../src/lib/use-block-back';
import { useAddDish } from '../../../../../src/state/add-dish';
import { announcePicksChanged } from '../../../../../src/state/pick-changes';

/** Edit a pick's photo, note and tags. The dish and restaurant are fixed: remove the pick and add it again to change them. */
export default function EditPick() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft, dispatch } = useAddDish();
  const [pick, setPick] = useState<Pick | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);
  useBlockBack(busy);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const found = (await getMyPicks(getSupabase())).find((p) => p.id === id) ?? null;
      setMissing(found === null);
      setPick(found);
      if (found && !hydrated.current) {
        hydrated.current = true;
        dispatch({
          type: 'hydrate',
          draft: {
            note: found.note ?? '',
            photoUri: found.photoUrl,
            tags: found.tags.filter((t) => t.kind !== 'personal'),
            personalTags: found.tags.filter((t) => t.kind === 'personal').map((t) => t.name),
          },
        });
      }
    } catch (e) {
      setLoadError(friendlyMessage(e));
    }
  }, [id, dispatch]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!pick || busy) return;
    setBusy(true);
    setError(null);
    try {
      const patch: PickPatch = {
        note: draft.note.trim() === '' ? null : draft.note.trim(),
        tagIds: draft.tags.map((t) => t.id),
        personalTags: draft.personalTags,
      };
      if (draft.photoUri !== pick.photoUrl) {
        if (draft.photoUri === null) {
          patch.photo = null;
        } else {
          try {
            patch.photo = await preparePickPhoto(draft.photoUri);
          } catch {
            // Unlike adding, an edit that cannot use the new photo changes nothing.
            throw new ApiError('The photo could not be prepared', 'invalid_photo');
          }
        }
      }
      await updatePick(getSupabase(), pick.id, patch);
      announcePicksChanged();
      router.back();
    } catch (e) {
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  if (!pick) {
    const problem = loadError ?? (missing ? friendlyMessage(new ApiError('Pick not found', 'pick_not_found')) : null);
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Edit dish" onBack={() => router.back()} />
        <View style={styles.center}>
          {problem ? (
            <>
              <Text style={styles.problem} accessibilityRole="alert">
                {problem}
              </Text>
              {loadError ? <PrimaryButton label="Try again" onPress={() => void load()} /> : null}
            </>
          ) : (
            <ActivityIndicator testID="edit-loading" color={colors.emberGlow} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoider>
        <ScreenHeader title="Edit dish" onBack={() => router.back()} backDisabled={busy} />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.fixed}>
            <Text style={styles.dish}>{pick.dish.name}</Text>
            <Text style={styles.where}>{`${pick.place.name} · ${pick.place.label}`}</Text>
          </View>
          <Text style={styles.helper}>
            To change the dish or restaurant, remove this pick and add it again.
          </Text>

          <PhotoField uri={draft.photoUri} onChange={(uri) => dispatch({ type: 'setPhoto', uri })} />

          <TextField
            label="Note (optional)"
            value={draft.note}
            onChangeText={(note) => dispatch({ type: 'setNote', note })}
            multiline
            maxLength={NOTE_MAX}
            counter={draft.note.length > 0 ? `${draft.note.length} / ${NOTE_MAX}` : undefined}
          />

          {tagsOpen ? (
            <TagPicker
              tags={draft.tags}
              personalTags={draft.personalTags}
              onToggleTag={(tag) => dispatch({ type: 'toggleTag', tag })}
              onTogglePersonal={(name) => dispatch({ type: 'togglePersonalTag', name })}
              onSelectPersonal={(name) => dispatch({ type: 'selectPersonalTag', name })}
              onMore={(kind) =>
                router.push({ pathname: `/pick/${pick.id}/edit/tags-search`, params: { kind } })
              }
              onHide={() => setTagsOpen(false)}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add tags"
              onPress={() => setTagsOpen(true)}
              style={styles.addTags}
            >
              <Icon name="tag" size={20} color={colors.emberGlow} />
              <View style={styles.addTagsText}>
                <Text style={styles.addTagsTitle}>Add tags</Text>
                <Text style={styles.addTagsSub}>Optional · food type, dietary, your own</Text>
              </View>
              <Icon name="plus" size={18} color={colors.smoke} />
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.bottom}>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <PrimaryButton label="Save" onPress={() => void save()} busy={busy} />
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  problem: { fontFamily: fontFamily.uiMedium, fontSize: 15, color: colors.bone, textAlign: 'center' },
  content: { gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  fixed: {
    gap: 2,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dish: { fontFamily: fontFamily.uiBold, fontSize: 16, color: colors.bone },
  where: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  helper: { fontFamily: fontFamily.ui, fontSize: 13, lineHeight: 13 * 1.5, color: colors.smoke },
  addTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
  },
  addTagsText: { flex: 1, gap: 2 },
  addTagsTitle: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  addTagsSub: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  bottom: { gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
