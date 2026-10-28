import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, friendlyMessage, getMyPicks, promotePick } from '@finalmeal/api';
import type { Pick } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { NOTE_MAX } from '@finalmeal/core';
import { DishField } from '../../../src/components/DishField';
import { Icon } from '../../../src/components/Icon';
import { KeyboardAvoider } from '../../../src/components/KeyboardAvoider';
import { PhotoField } from '../../../src/components/PhotoField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SkullMark } from '../../../src/components/SkullMark';
import { TagPicker } from '../../../src/components/TagPicker';
import { TextField } from '../../../src/components/TextField';
import { TierChooser } from '../../../src/components/TierChooser';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useBlockBack, useModalSwipe } from '../../../src/lib/use-block-back';
import { ctaFor, draftHasContent, findExistingPick, useAddDish } from '../../../src/state/add-dish';
import { announcePicksChanged } from '../../../src/state/pick-changes';
import { useSavePick } from '../../../src/state/save-pick';

/** Add a dish: photo, dish, restaurant, which list, a note and optional tags, in one sheet. */
export default function AddDish() {
  const router = useRouter();
  const { draft, dispatch } = useAddDish();
  const [finalCount, setFinalCount] = useState<number | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const { busy: saving, save } = useSavePick();
  const [promoting, setPromoting] = useState(false);
  const busy = saving || promoting;
  useBlockBack(busy);
  // Swipe-down dismisses an empty form, but not one with content or a save in flight.
  useModalSwipe(!busy && !draftHasContent(draft));
  const [error, setError] = useState<string | null>(null);
  /** Set when the dish is already an honorable pick that the person was adding to the Final Meal. */
  const [promotable, setPromotable] = useState<Pick | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyPicks(getSupabase()).then(
      (picks) => {
        if (!cancelled) setFinalCount(picks.filter((p) => p.tier === 'final').length);
      },
      () => {
        // Without the count the form still works: a full Final Meal is reported when adding.
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // A refusal (and the offer to promote) belongs to the dish as it was; changing it clears them.
  const placeId = draft.place?.id;
  useEffect(() => {
    setError(null);
    setPromotable(null);
  }, [draft.dishName, draft.dishId, draft.tier, placeId]);

  const cta = ctaFor(draft, finalCount);
  const place = draft.place;

  function done() {
    router.dismissTo('/(app)/you');
  }

  async function submit() {
    if (cta.disabled || busy) return;
    if (cta.mode === 'swap') {
      router.push('/add/swap');
      return;
    }
    setError(null);
    setPromotable(null);
    const outcome = await save(draft);
    if (!outcome) return;
    if (outcome.status === 'saved') {
      announcePicksChanged({ photoFailed: outcome.photoFailed });
      done();
      return;
    }
    const e = outcome.error;
    if (e instanceof ApiError && e.code === 'final_full') {
      setFinalCount(5);
      router.push('/add/swap');
      return;
    }
    setError(friendlyMessage(e));
    if (e instanceof ApiError && e.code === 'duplicate_pick' && draft.tier === 'final') {
      try {
        const existing = findExistingPick(await getMyPicks(getSupabase()), draft);
        if (existing?.tier === 'honorable') setPromotable(existing);
      } catch {
        // The refusal is already on screen; without the lookup there is just no shortcut.
      }
    }
  }

  async function promote() {
    if (!promotable || busy) return;
    setPromoting(true);
    setError(null);
    try {
      await promotePick(getSupabase(), promotable.id);
      announcePicksChanged();
      done();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'final_full') {
        // The five are full: choose which Final Meal dish this one replaces.
        setFinalCount(5);
        setPromoting(false);
        router.push({ pathname: '/add/swap', params: { promote: promotable.id } });
        return;
      }
      setError(friendlyMessage(e));
      setPromotable(null);
      setPromoting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoider>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            Add a dish
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            disabled={busy}
            onPress={() => router.back()}
            style={[styles.close, busy && styles.closeOff]}
          >
            <Icon name="close" size={21} color={colors.bone} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tagsOpen ? (
            <>
              <View style={styles.summary}>
                <View style={styles.summaryTile}>
                  {draft.photoUri ? (
                    <Image source={{ uri: draft.photoUri }} style={styles.summaryImage} />
                  ) : (
                    <Icon name="image" size={14} color={colors.dim} />
                  )}
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryDish} numberOfLines={1}>
                    {draft.dishName.trim() || 'Your dish'}
                  </Text>
                  <Text style={styles.summaryWhere} numberOfLines={1}>
                    {[place ? `${place.name} · ${place.city}` : 'No restaurant yet', draft.note.trim() ? 'note added' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {draft.tier === 'final' ? (
                  <View style={styles.summaryTier}>
                    <SkullMark size={12} color={colors.emberGlow} />
                    <Text style={styles.summaryTierText}>Final Meal</Text>
                  </View>
                ) : (
                  <Text style={[styles.summaryTierText, styles.summaryHonorable]}>Honorable</Text>
                )}
              </View>
              <TagPicker
                tags={draft.tags}
                personalTags={draft.personalTags}
                onToggleTag={(tag) => dispatch({ type: 'toggleTag', tag })}
                onTogglePersonal={(name) => dispatch({ type: 'togglePersonalTag', name })}
                onSelectPersonal={(name) => dispatch({ type: 'selectPersonalTag', name })}
                onMore={(kind) =>
                  router.push({ pathname: '/add/tags-search', params: { kind } })
                }
                onHide={() => setTagsOpen(false)}
              />
            </>
          ) : (
            <>
              <PhotoField uri={draft.photoUri} onChange={(uri) => dispatch({ type: 'setPhoto', uri })} />
              <DishField
                value={draft.dishName}
                placeId={place?.id ?? null}
                onChangeText={(name) => dispatch({ type: 'setDishName', name })}
                onChoose={(suggestion) => dispatch({ type: 'chooseSuggestion', suggestion })}
              />

              <View style={styles.group}>
                <Text style={styles.label}>Restaurant</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    place ? `Restaurant: ${place.name}, ${place.label}. Change` : 'Restaurant: Choose a restaurant'
                  }
                  onPress={() => router.push('/add/place')}
                  style={styles.restaurant}
                >
                  <Icon name="pin" size={20} color={place ? colors.emberGlow : colors.smoke} />
                  {place ? (
                    <>
                      <View style={styles.restaurantText}>
                        <Text style={styles.restaurantName} numberOfLines={1}>
                          {place.name}
                        </Text>
                        <Text style={styles.restaurantWhere} numberOfLines={1}>
                          {place.label}
                        </Text>
                      </View>
                      <Text style={styles.change}>Change</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.restaurantEmpty}>Choose a restaurant</Text>
                      <Icon name="chev" size={18} color={colors.smoke} />
                    </>
                  )}
                </Pressable>
              </View>

              <TierChooser
                value={draft.tier}
                onChange={(tier) => dispatch({ type: 'setTier', tier })}
                finalCount={finalCount}
              />

              <TextField
                label="Note (optional)"
                value={draft.note}
                onChangeText={(note) => dispatch({ type: 'setNote', note })}
                multiline
                maxLength={NOTE_MAX}
                counter={draft.note.length > 0 ? `${draft.note.length} / ${NOTE_MAX}` : undefined}
              />

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
            </>
          )}
        </ScrollView>

        <View style={styles.bottom}>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {promotable ? (
            <PrimaryButton
              label="Make it a Final Meal instead"
              variant="secondary"
              onPress={() => void promote()}
              disabled={busy}
            />
          ) : null}
          <PrimaryButton
            label={cta.label}
            onPress={() => void submit()}
            disabled={cta.disabled}
            busy={busy}
            icon={
              cta.mode === 'add' && cta.label === 'Add to Final Meal' ? (
                <SkullMark size={16} color={colors.white} />
              ) : undefined
            }
          />
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ash },
  flex: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: { fontFamily: fontFamily.display, fontSize: 30, color: colors.bone },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeOff: { opacity: 0.4 },
  content: { gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  group: { gap: 8 },
  label: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  restaurant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 64,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  restaurantText: { flex: 1, gap: 2, minWidth: 0 },
  restaurantName: { fontFamily: fontFamily.uiSemiBold, fontSize: 16, color: colors.bone },
  restaurantWhere: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  restaurantEmpty: { flex: 1, fontFamily: fontFamily.uiMedium, fontSize: 16, color: colors.dim },
  change: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.smoke },
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.night,
    borderWidth: 1,
    borderColor: colors.line,
  },
  summaryTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  summaryImage: { width: 40, height: 40 },
  summaryText: { flex: 1, gap: 2, minWidth: 0 },
  summaryDish: { fontFamily: fontFamily.uiBold, fontSize: 15, color: colors.bone },
  summaryWhere: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  summaryTier: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryTierText: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.06 * 11,
    textTransform: 'uppercase',
    color: colors.emberGlow,
  },
  summaryHonorable: { color: colors.smoke },
  bottom: { gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
