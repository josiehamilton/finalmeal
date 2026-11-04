import type { ActivityType } from '@finalmeal/core';
import type { FinalMealClient } from './client';
import { ApiError, throwIfError } from './errors';
import { toFollowState, toPersonSummary, pageSize } from './people';
import type { FollowState, PersonSummary } from './people';
import { PICK_PHOTO_BUCKET } from './picks';
import { requireUserId } from './profile';

export type { ActivityType } from '@finalmeal/core';

/** One row in the Activity list. */
export interface ActivityItem {
  /** The notification's id (what `markNotificationsRead` takes). */
  id: string;
  type: ActivityType;
  at: string;
  readAt: string | null;
  actor: PersonSummary;
  pickId: string | null;
  dishName: string | null;
  otherDishName: string | null;
  listTitle: string | null;
  /** The photo on the pick the activity is about. */
  photoUrl: string | null;
  /** How the signed-in person follows the actor (for the Follow back button). */
  viewerFollow: FollowState;
  /** A follow request still waiting for an answer (show Approve and Decline). */
  requestPending: boolean;
}

interface NotificationRow {
  id: string;
  created_at: string;
  read_at: string | null;
  type: ActivityType;
  actor_id: string;
  actor_username: string;
  actor_display_name: string;
  actor_avatar_path: string | null;
  pick_id: string | null;
  dish_name: string | null;
  photo_path: string | null;
  other_dish_name: string | null;
  list_title: string | null;
  viewer_follow: string;
  request_pending: boolean;
}

export function toActivityItem(client: FinalMealClient, row: NotificationRow): ActivityItem {
  return {
    id: row.id,
    type: row.type,
    at: row.created_at,
    readAt: row.read_at,
    actor: toPersonSummary(client, {
      id: row.actor_id,
      username: row.actor_username,
      display_name: row.actor_display_name,
      avatar_path: row.actor_avatar_path,
    }),
    pickId: row.pick_id,
    dishName: row.dish_name,
    otherDishName: row.other_dish_name,
    listTitle: row.list_title,
    photoUrl: row.photo_path
      ? client.storage.from(PICK_PHOTO_BUCKET).getPublicUrl(row.photo_path).data.publicUrl
      : null,
    viewerFollow: toFollowState(row.viewer_follow),
    requestPending: row.request_pending,
  };
}

/** The signed-in person's notifications, newest first. Pass the last one's `at` as `before` for the next page. */
export async function getMyNotifications(
  client: FinalMealClient,
  opts: { before?: string; limit?: number } = {},
): Promise<ActivityItem[]> {
  const { data, error } = await client
    .rpc(
      'get_my_notifications',
      { p_before: opts.before, p_limit: pageSize(opts.limit ?? 20) },
      { get: true },
    )
    .retry(false);
  throwIfError(error);
  return ((data ?? []) as unknown as NotificationRow[]).map((row) => toActivityItem(client, row));
}

/** How many notifications the person has not seen (the badge). */
export async function getUnreadCount(client: FinalMealClient): Promise<number> {
  const { data, error } = await client
    .rpc('unread_notification_count', undefined, { get: true })
    .retry(false);
  throwIfError(error);
  return typeof data === 'number' ? data : 0;
}

/** Marks the given notifications read, or all of them when no ids are given. */
export async function markNotificationsRead(
  client: FinalMealClient,
  ids?: string[],
): Promise<void> {
  const { error } = await client.rpc('mark_notifications_read', { p_ids: ids });
  throwIfError(error);
}

/**
 * Calls `onChange` whenever a new notification arrives for `userId` (refetch the list and the
 * count then). Returns a function that stops listening.
 */
export function subscribeToMyNotifications(
  client: FinalMealClient,
  userId: string,
  onChange: () => void,
): () => void {
  const channel = client
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/** Which pushes the person wants. */
export interface NotificationSettings {
  dethroned: boolean;
  newFollowers: boolean;
  saves: boolean;
  friendsFinals: boolean;
}

interface PreferencesRow {
  push_dethroned: boolean;
  push_new_followers: boolean;
  push_saves: boolean;
  push_friends_finals: boolean;
}

export function toNotificationSettings(row: PreferencesRow): NotificationSettings {
  return {
    dethroned: row.push_dethroned,
    newFollowers: row.push_new_followers,
    saves: row.push_saves,
    friendsFinals: row.push_friends_finals,
  };
}

const PREFERENCE_COLUMNS = 'push_dethroned, push_new_followers, push_saves, push_friends_finals';

async function readSettings(client: FinalMealClient, uid: string): Promise<NotificationSettings> {
  const { data, error } = await client
    .from('notification_preferences')
    .select(PREFERENCE_COLUMNS)
    .eq('user_id', uid)
    .maybeSingle()
    .retry(false);
  throwIfError(error);
  if (!data) throw new ApiError('No profile for this account', 'profile_not_found');
  return toNotificationSettings(data);
}

export async function getMyNotificationSettings(
  client: FinalMealClient,
): Promise<NotificationSettings> {
  return readSettings(client, await requireUserId(client));
}

/** Changes the settings in the patch and returns all four. */
export async function updateMyNotificationSettings(
  client: FinalMealClient,
  patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const uid = await requireUserId(client);
  const row: Partial<PreferencesRow> = {};
  if (patch.dethroned !== undefined) row.push_dethroned = patch.dethroned;
  if (patch.newFollowers !== undefined) row.push_new_followers = patch.newFollowers;
  if (patch.saves !== undefined) row.push_saves = patch.saves;
  if (patch.friendsFinals !== undefined) row.push_friends_finals = patch.friendsFinals;
  if (Object.keys(row).length > 0) {
    const { error } = await client.from('notification_preferences').update(row).eq('user_id', uid);
    throwIfError(error);
  }
  return readSettings(client, uid);
}
