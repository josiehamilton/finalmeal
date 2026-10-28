import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { finishOnboarding, friendlyMessage } from '@finalmeal/api';
import { NOTE_MAX } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { DishField } from '../../../src/components/DishField';
import { KeyboardAvoider } from '../../../src/components/KeyboardAvoider';
import { PhotoField } from '../../../src/components/PhotoField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { RestaurantField } from '../../../src/components/RestaurantField';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { SkullMark } from '../../../src/components/SkullMark';
import { TagPicker } from '../../../src/components/TagPicker';
import { TextField } from '../../../src/components/TextField';
import { fontFamily } from '../../../src/lib/fonts';
import { getSupabase } from '../../../src/lib/supabase';
import { useBlockBack, useBlockSwipeBack } from '../../../src/lib/use-block-back';
import { useAddDish } from '../../../src/state/add-dish';
import { announcePicksChanged } from '../../../src/state/pick-changes';
import { useSavePick } from '../../../src/state/save-pick';

/**
 * Your first pick: the Add-a-dish form locked to Final Meal (no tier choice, and a new person has
 * no picks, so there is never a swap). Lock it in saves the pick, then finishes onboarding, then
 * shows the loading screen. If finishing fails after the pick was saved, trying again only
 * finishes: it never adds the pick twice.
 */
export default function AddFirst() {
  const router = useRouter();
  const { draft, dispatch } = useAddDish();
  const { busy: saving, save } = useSavePick();
  const [pickSaved, setPickSaved] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // useSavePick stays busy after a good save (the screen is meant to be closing); here a failed
  // finish keeps the screen open, so only a save that has not finished counts.
  const busy = (saving && !pickSaved) || finishing;
  useBlockBack(busy);
  // First screen of its own stack: the swipe belongs to the route above it too.
  useBlockSwipeBack(busy, { includeParent: true });

  const ready = draft.place !== null && draft.dishName.trim() !== '';

  async function lockIn() {
    if (!ready || busy) return;
    setError(null);
    let photoMissed = photoFailed;
    if (!pickSaved) {
      const outcome = await save(draft);
      if (!outcome) return;
      if (outcome.status === 'failed') {
        setError(friendlyMessage(outcome.error));
        return;
      }
      photoMissed = outcome.photoFailed;
      setPhotoFailed(photoMissed);
      setPickSaved(true);
    }
    setFinishing(true);
    try {
      await finishOnboarding(getSupabase());
    } catch (e) {
      setError(friendlyMessage(e));
      setFinishing(false);
      return;
    }
    announcePicksChanged({ photoFailed: photoMissed });
    router.replace('/loading');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoider>
        <ScreenHeader
          title="Your first pick"
          onBack={() => router.back()}
          backDisabled={busy}
          right={<Text style={styles.count}>#1 of 5</Text>}
        />
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PhotoField
            layout="banner"
            uri={draft.photoUri}
            onChange={(uri) => dispatch({ type: 'setPhoto', uri })}
          />
          <DishField
            value={draft.dishName}
            placeId={draft.place?.id ?? null}
            onChangeText={(name) => dispatch({ type: 'setDishName', name })}
            onChoose={(suggestion) => dispatch({ type: 'chooseSuggestion', suggestion })}
          />
          <RestaurantField place={draft.place} onPress={() => router.push('/add-first/place')} />
          <TagPicker
            inline
            tags={draft.tags}
            personalTags={draft.personalTags}
            onToggleTag={(tag) => dispatch({ type: 'toggleTag', tag })}
            onTogglePersonal={(name) => dispatch({ type: 'togglePersonalTag', name })}
            onSelectPersonal={(name) => dispatch({ type: 'selectPersonalTag', name })}
            onMore={(kind) => router.push({ pathname: '/add-first/tags-search', params: { kind } })}
          />
          <TextField
            label="Why this one? (optional)"
            value={draft.note}
            onChangeText={(note) => dispatch({ type: 'setNote', note })}
            multiline
            maxLength={NOTE_MAX}
            counter={draft.note.length > 0 ? `${draft.note.length} / ${NOTE_MAX}` : undefined}
          />
        </ScrollView>
        <View style={styles.bottom}>
          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            label="Lock it in"
            icon={<SkullMark size={16} color={colors.white} />}
            onPress={() => void lockIn()}
            disabled={!ready}
            busy={busy}
          />
        </View>
      </KeyboardAvoider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  flex: { flex: 1 },
  count: { fontFamily: fontFamily.uiBold, fontSize: 13, color: colors.emberGlow },
  content: { gap: 18, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  bottom: { gap: 12, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
});
