import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { friendlyMessage, saveDish, unsaveDish } from '@finalmeal/api';
import type { FeedItem } from '@finalmeal/api';
import { countLabel, feedCaption, relativeTime } from '@finalmeal/core';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { SkullMark } from './SkullMark';
import { TagChips } from './TagChips';

const PHOTO_HEIGHT = 230;

interface FeedCardProps {
  item: FeedItem;
  /** The photo's height; the Feed board's 230, or the shorter 150 on First landing. */
  photoHeight?: number;
}

/**
 * One card in a feed: who did what and when, the pick's photo and badge, the dish, where, its
 * tags and note, and a Save button. Your own picks never reach a feed, so Save is always shown.
 */
export function FeedCard({ item, photoHeight = PHOTO_HEIGHT }: FeedCardProps) {
  const router = useRouter();
  const { actor, pick } = item;
  const isFinal = pick.tier === 'final';
  const [saved, setSaved] = useState(item.savedByMe);
  const [error, setError] = useState<string | null>(null);
  // A ref as well as state: two taps in one frame both see the same render.
  const inFlight = useRef(false);

  // A fresh answer from the server (a refresh) replaces ours, unless a call is mid-flight.
  useEffect(() => {
    if (!inFlight.current) setSaved(item.savedByMe);
  }, [item.savedByMe]);

  async function toggleSave() {
    if (inFlight.current) return;
    inFlight.current = true;
    const before = saved;
    setError(null);
    setSaved(!before);
    try {
      if (before) await unsaveDish(getSupabase(), pick.dish.id);
      else await saveDish(getSupabase(), pick.dish.id, pick.id);
    } catch (e) {
      setSaved(before);
      setError(friendlyMessage(e));
    } finally {
      inFlight.current = false;
    }
  }

  const openPerson = () => router.push(`/u/${actor.id}`);
  const openPick = () => router.push(`/pick/${pick.id}`);
  const lists = countLabel(item.listCount, 'list');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={openPerson} accessible={false} importantForAccessibility="no">
          <Avatar
            uri={actor.avatarUrl}
            name={actor.displayName}
            size={34}
            accessibilityLabel={`${actor.displayName}’s photo`}
          />
        </Pressable>
        <View style={styles.who}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`@${actor.username}`}
            onPress={openPerson}
            hitSlop={{ top: 6, bottom: 2, right: 12 }}
            style={styles.nameButton}
          >
            <Text style={styles.name} numberOfLines={1}>{`@${actor.username}`}</Text>
          </Pressable>
          <Text style={styles.caption} numberOfLines={1}>
            {`${feedCaption(item.kind, item.otherDishName)} · ${relativeTime(item.at, new Date())}`}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${pick.dish.name}`}
        onPress={openPick}
        style={[styles.photo, { height: photoHeight }]}
      >
        {pick.photoUrl ? (
          <Image testID="feed-photo" source={{ uri: pick.photoUrl }} style={styles.photoImage} />
        ) : (
          <View testID="feed-photo-placeholder" style={styles.placeholder}>
            <Icon name="image" size={28} color={colors.dim} />
          </View>
        )}
        <View style={[styles.badge, !isFinal && styles.badgeHonorable]}>
          {isFinal ? <SkullMark size={12} color={colors.white} /> : null}
          <Text style={[styles.badgeText, !isFinal && styles.badgeTextHonorable]}>
            {isFinal ? (pick.slot ? `Final Meal · #${pick.slot}` : 'Final Meal') : 'Honorable'}
          </Text>
        </View>
      </Pressable>

      <View style={styles.details}>
        <Pressable accessibilityRole="button" onPress={openPick}>
          <Text style={styles.dish}>{pick.dish.name}</Text>
        </Pressable>
        <View style={styles.where}>
          <Icon name="pin" size={14} color={colors.smoke} />
          <Text style={styles.whereText} numberOfLines={1}>
            {`${pick.place.name} · ${pick.place.city}`}
          </Text>
        </View>
        <TagChips tags={pick.tags} />
        {pick.note ? <Text style={styles.note}>{`“${pick.note}”`}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Saved' : 'Save'}
          accessibilityState={{ selected: saved }}
          onPress={() => void toggleSave()}
          style={styles.save}
        >
          <Icon
            name="bookmark"
            size={20}
            color={saved ? colors.emberGlow : colors.bone}
            fill={saved ? colors.emberGlow : 'none'}
          />
          <Text style={styles.saveText}>{saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
        <Text style={styles.count}>{lists ?? ''}</Text>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  who: { flex: 1, gap: 1, minWidth: 0 },
  nameButton: { alignSelf: 'flex-start' },
  name: { fontFamily: fontFamily.uiBold, fontSize: 14, color: colors.bone },
  caption: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.dim },
  photo: { backgroundColor: colors.ashRaised },
  photoImage: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.ember,
  },
  badgeHonorable: {
    backgroundColor: colors.scrim,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  badgeText: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    color: colors.white,
  },
  badgeTextHonorable: { color: colors.honorable },
  details: { gap: 6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  dish: { fontFamily: fontFamily.serif, fontSize: 26, lineHeight: 26 * 1.1, color: colors.bone },
  where: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whereText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  note: {
    marginTop: 4,
    fontFamily: fontFamily.serifItalic,
    fontSize: 16,
    lineHeight: 16 * 1.4,
    color: colors.honorable,
  },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 6 },
  save: { height: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveText: { fontFamily: fontFamily.uiSemiBold, fontSize: 13, color: colors.bone },
  count: { flex: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.dim },
  error: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
  },
});
