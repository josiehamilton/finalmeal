import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActivityItem } from '@finalmeal/api';
import { activitySentence, relativeTime } from '@finalmeal/core';
import { colors, radii } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { useFollow } from '../state/follow';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';
import { Icon } from './Icon';

interface ActivityRowProps {
  item: ActivityItem;
  /** Shows the ember wash and dot. The caller owns this so tapping or Mark all read clears it. */
  unread: boolean;
  /** The time the labels are measured against. */
  now: Date;
  /** The row was tapped: the screen marks it read and opens its pick or person. */
  onOpen: (item: ActivityItem) => void;
  /** Approve (true) or Decline (false) a pending follow request. */
  onRespond: (item: ActivityItem, accept: boolean) => void;
  /** A pending request that has just been approved: the row now reads as a follow. */
  approved?: boolean;
  /** An Approve or Decline call is in flight. */
  responding?: boolean;
  /** Friendly copy for a failed Approve or Decline. */
  error?: string | null;
}

const PICK_TYPES = new Set<ActivityItem['type']>([
  'added_final',
  'added_honorable',
  'dethroned',
  'promoted',
  'saved_pick',
]);

function RowFollow({ item }: { item: ActivityItem }) {
  const { actor, viewerFollow } = item;
  const follow = useFollow({
    id: actor.id,
    username: actor.username,
    viewerFollow,
    // They follow you (that is what the row says), so a plain Follow reads "Follow back".
    followsViewer: true,
  });
  return (
    <FollowButton
      size="row"
      state={follow.state}
      followsViewer
      busy={follow.busy}
      onPress={() => void follow.toggle()}
    />
  );
}

function Thumb({ item }: { item: ActivityItem }) {
  if (item.photoUrl) {
    return (
      <Image
        source={{ uri: item.photoUrl }}
        accessibilityLabel={`Photo of ${item.dishName ?? 'the dish'}`}
        style={styles.thumb}
        resizeMode="cover"
      />
    );
  }
  return (
    <View testID="activity-thumb" style={[styles.thumb, styles.thumbEmpty]}>
      <Icon name="image" size={16} color={colors.dim} />
    </View>
  );
}

/** One line of the Activity list. */
export function ActivityRow({
  item,
  unread,
  now,
  onOpen,
  onRespond,
  approved = false,
  responding = false,
  error = null,
}: ActivityRowProps) {
  const pending = item.type === 'follow_requested' && item.requestPending && !approved;
  const sentence = activitySentence({
    type: item.type,
    actorName: item.actor.displayName,
    dishName: item.dishName,
    otherDishName: item.otherDishName,
    listTitle: item.listTitle,
    requestPending: pending,
  });
  const showFollow = item.type === 'followed' || (item.type === 'follow_requested' && !pending);

  return (
    <View style={[styles.row, unread && styles.unread]}>
      <View style={styles.line}>
        {unread ? (
          <View accessible accessibilityLabel="Unread" style={styles.dot} />
        ) : (
          <View style={styles.dotSpace} />
        )}
        <Pressable accessibilityRole="button" onPress={() => onOpen(item)} style={styles.main}>
          <Avatar
            uri={item.actor.avatarUrl}
            name={item.actor.displayName}
            size={46}
            accessibilityLabel={`${item.actor.displayName}’s photo`}
          />
          <View style={styles.text}>
            <Text style={styles.sentence}>
              {sentence.map((part, i) => (
                <Text
                  key={i}
                  style={
                    part.style === 'name'
                      ? styles.name
                      : part.style === 'dish'
                        ? styles.dish
                        : undefined
                  }
                >
                  {part.text}
                </Text>
              ))}
            </Text>
            <Text style={styles.time}>{relativeTime(item.at, now)}</Text>
          </View>
          {PICK_TYPES.has(item.type) ? <Thumb item={item} /> : null}
        </Pressable>
        {showFollow ? <RowFollow item={item} /> : null}
        {pending ? (
          <View style={styles.answers}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Approve ${item.actor.displayName}`}
              accessibilityState={{ disabled: responding, busy: responding }}
              disabled={responding}
              onPress={() => onRespond(item, true)}
              style={({ pressed }) => [styles.pill, styles.approve, pressed && styles.pressed]}
            >
              <Text style={[styles.pillLabel, { color: colors.white }]}>Approve</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Decline ${item.actor.displayName}`}
              accessibilityState={{ disabled: responding, busy: responding }}
              disabled={responding}
              onPress={() => onRespond(item, false)}
              style={({ pressed }) => [styles.pill, styles.decline, pressed && styles.pressed]}
            >
              <Text style={[styles.pillLabel, { color: colors.bone }]}>Decline</Text>
            </Pressable>
          </View>
        ) : null}
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
  row: { paddingVertical: 14, paddingHorizontal: 20, gap: 6 },
  unread: { backgroundColor: colors.emberWash },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emberGlow },
  dotSpace: { width: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  text: { flex: 1, gap: 3, minWidth: 0 },
  sentence: {
    fontFamily: fontFamily.ui,
    fontSize: 14,
    lineHeight: 14 * 1.45,
    color: colors.bone,
  },
  name: { fontFamily: fontFamily.uiBold },
  dish: { fontFamily: fontFamily.serifItalic, fontSize: 15 },
  time: { fontFamily: fontFamily.ui, fontSize: 12, color: colors.dim },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.ashRaised },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  answers: { gap: 6 },
  pill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approve: { backgroundColor: colors.ember },
  decline: { borderWidth: 1, borderColor: colors.lineStrong },
  pressed: { opacity: 0.85 },
  pillLabel: { fontFamily: fontFamily.uiBold, fontSize: 12 },
  error: {
    paddingLeft: 20,
    fontFamily: fontFamily.uiMedium,
    fontSize: 13,
    color: colors.danger,
  },
});
