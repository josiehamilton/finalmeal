import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage } from '@finalmeal/api';
import type { PickDetail } from '@finalmeal/api';
import { colors, radii } from '@finalmeal/ui-tokens';
import { openDirections } from '../lib/directions';
import { fontFamily } from '../lib/fonts';
import { useSave } from '../state/save';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { PickersRow } from './PickersRow';
import { SaveButton } from './SaveButton';
import { SkullMark } from './SkullMark';
import { TagChips } from './TagChips';

const HERO_HEIGHT = 400;

/**
 * Someone else's pick (the PickDetail board): the hero with a bookmark, the dish and where, its
 * tags, Directions and Save to try, their note with who wrote it, and who else has it as a Final
 * Meal. There is no Share and no owner menu.
 */
export function OtherPickView({ detail }: { detail: PickDetail }) {
  const router = useRouter();
  const { pick, owner } = detail;
  const save = useSave(pick.dish.id, pick.id, detail.savedByMe);
  const [mapError, setMapError] = useState<string | null>(null);
  const isFinal = pick.tier === 'final' && pick.slot !== null;
  const error = mapError ?? save.error;

  function directions() {
    setMapError(null);
    openDirections(pick.place).catch(() => setMapError(friendlyMessage(null)));
  }

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View>
          {pick.photoUrl ? (
            <Image
              testID="hero-photo"
              source={{ uri: pick.photoUrl }}
              accessibilityLabel={`Photo of ${pick.dish.name}`}
              resizeMode="cover"
              style={styles.hero}
            />
          ) : (
            <View testID="hero-placeholder" style={[styles.hero, styles.placeholder]}>
              <SkullMark size={72} color={colors.ember} />
            </View>
          )}
          <View style={styles.badgeWrap}>
            <View style={[styles.badge, !isFinal && styles.badgeHonorable]}>
              {isFinal ? <SkullMark size={12} color={colors.white} /> : null}
              <Text style={[styles.badgeText, !isFinal && styles.badgeTextHonorable]}>
                {isFinal ? `Final Meal · #${pick.slot}` : 'Honorable'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.head}>
            <Text style={styles.dish} accessibilityRole="header">
              {pick.dish.name}
            </Text>
            <View style={styles.where}>
              <Icon name="pin" size={16} color={colors.smoke} />
              <Text style={styles.whereText}>{pick.place.label}</Text>
            </View>
            <TagChips tags={pick.tags} />
          </View>

          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Directions"
              onPress={directions}
              style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
            >
              <Icon name="directions" size={18} color={colors.bone} />
              <Text style={styles.directionsLabel}>Directions</Text>
            </Pressable>
            <SaveButton saved={save.saved} busy={save.busy} onPress={() => void save.toggle()} />
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View testID="pick-quote" style={styles.quote}>
            {pick.note ? <Text style={styles.noteText}>{`“${pick.note}”`}</Text> : null}
            {/* The whole caption is one link to the owner, so a screen reader can reach it. */}
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/u/${owner.id}`)}
              style={styles.caption}
            >
              <Avatar
                uri={owner.avatarUrl}
                name={owner.displayName}
                size={28}
                accessibilityLabel={`${owner.displayName}’s photo`}
              />
              <Text style={styles.captionText}>
                <Text style={styles.captionName}>{`@${owner.username}`}</Text>
                {isFinal ? ` · #${pick.slot} on their Final Meal` : ' · Honorable Mention'}
              </Text>
            </Pressable>
          </View>

          <PickersRow pickers={detail.pickers} finalCount={detail.finalCount} />
        </View>
      </ScrollView>

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.bar}>
        <View pointerEvents="box-none" style={styles.barRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.circle}
          >
            <Icon name="back" size={21} color={colors.bone} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save"
            accessibilityState={{ selected: save.saved, busy: save.busy }}
            onPress={() => void save.toggle()}
            style={styles.circle}
          >
            <Icon
              name="bookmark"
              size={21}
              color={save.saved ? colors.emberGlow : colors.bone}
              fill={save.saved ? colors.emberGlow : 'none'}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  scroll: { paddingBottom: 40 },
  hero: { width: '100%', height: HERO_HEIGHT },
  placeholder: { backgroundColor: colors.ashRaised, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 4 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: { position: 'absolute', left: 20, bottom: 16 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.ember,
  },
  badgeHonorable: { backgroundColor: colors.ashRaised },
  badgeText: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    color: colors.white,
  },
  badgeTextHonorable: { color: colors.honorable },
  body: { gap: 18, paddingHorizontal: 20, paddingTop: 20 },
  head: { gap: 6 },
  dish: {
    fontFamily: fontFamily.serif,
    fontSize: 40,
    lineHeight: 40 * 1.05,
    letterSpacing: -0.01 * 40,
    color: colors.bone,
  },
  where: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whereText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 15, color: colors.smoke },
  buttons: { flexDirection: 'row', gap: 10 },
  directions: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  directionsLabel: { fontFamily: fontFamily.uiBold, fontSize: 14, letterSpacing: 0.01 * 14, color: colors.bone },
  pressed: { opacity: 0.85 },
  error: { fontFamily: fontFamily.uiMedium, fontSize: 13, color: colors.danger },
  quote: {
    padding: 16,
    gap: 12,
    borderRadius: 18,
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.line,
  },
  noteText: {
    fontFamily: fontFamily.serifItalic,
    fontSize: 19,
    lineHeight: 19 * 1.4,
    color: colors.honorable,
  },
  caption: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  captionText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  captionName: { fontFamily: fontFamily.uiBold, color: colors.bone },
});
