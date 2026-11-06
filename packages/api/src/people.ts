import type { FinalMealClient } from './client';
import { throwIfError } from './errors';
import { AVATAR_BUCKET } from './profile';

/** Who someone is, as shown on a card or in a list. */
export interface PersonSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** How the signed-in person follows someone: not at all, a pending request, or following. */
export type FollowState = 'none' | 'requested' | 'active';

export interface PersonRow extends PersonSummary {
  viewerFollow: FollowState;
  followsViewer: boolean;
  isMe: boolean;
}

export interface SuggestedPerson extends PersonRow {
  /** Their number one Final Meal dish, when they have one. */
  topDish: string | null;
}

export interface ProfileView extends PersonSummary {
  /** Null when the viewer may not see it (a private account they do not follow). */
  bio: string | null;
  /** The home city as text; null when hidden or not set. */
  homeCity: string | null;
  visibility: 'public' | 'private';
  counts: { followers: number; following: number; dishes: number | null };
  viewerFollow: FollowState;
  followsViewer: boolean;
  /** False for a private account the viewer does not follow: show only the header. */
  canSeePicks: boolean;
  isMe: boolean;
}

/** Page size for people lists. The database caps it at 50. */
const DEFAULT_PAGE = 20;
const MAX_PAGE = 50;

/**
 * A page size the database accepts: at most 50, never negative, 20 when it is not a number. A
 * list that comes back shorter than this is the last page (so a caller who asks for more than
 * 50 must compare against `pageSize(limit)`, not `limit`).
 */
export function pageSize(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_PAGE;
  return Math.min(Math.max(Math.floor(limit), 0), MAX_PAGE);
}

export function toFollowState(value: string | null | undefined): FollowState {
  return value === 'active' || value === 'requested' ? value : 'none';
}

/** The public URL of an avatar file, or null when the person has none. */
export function avatarUrlFor(client: FinalMealClient, path: string | null): string | null {
  return path ? client.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

export function toPersonSummary(
  client: FinalMealClient,
  row: { id: string; username: string; display_name: string; avatar_path: string | null },
): PersonSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: avatarUrlFor(client, row.avatar_path),
  };
}

interface PersonRowData {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  viewer_follow: string;
  follows_viewer: boolean;
  is_me: boolean;
}

export function toPersonRow(client: FinalMealClient, row: PersonRowData): PersonRow {
  return {
    ...toPersonSummary(client, row),
    viewerFollow: toFollowState(row.viewer_follow),
    followsViewer: row.follows_viewer,
    isMe: row.is_me,
  };
}

interface ProfileRowData extends PersonRowData {
  bio: string | null;
  home_city: string | null;
  visibility: 'public' | 'private';
  followers_count: number;
  following_count: number;
  dishes_count: number | null;
  can_see_picks: boolean;
}

export function toProfileView(client: FinalMealClient, row: ProfileRowData): ProfileView {
  return {
    ...toPersonSummary(client, row),
    bio: row.bio,
    homeCity: row.home_city,
    visibility: row.visibility,
    counts: {
      followers: row.followers_count,
      following: row.following_count,
      dishes: row.dishes_count,
    },
    viewerFollow: toFollowState(row.viewer_follow),
    followsViewer: row.follows_viewer,
    canSeePicks: row.can_see_picks,
    isMe: row.is_me,
  };
}

/**
 * Someone's profile as the signed-in person may see it, or null when there is no such person or
 * they are hidden by a block. A private account the viewer does not follow comes back with no
 * bio, home city or dish count and `canSeePicks: false`.
 */
export async function getProfile(client: FinalMealClient, id: string): Promise<ProfileView | null> {
  // GET, so the client's read timeout still bounds this call.
  const { data, error } = await client
    .rpc('get_profile', { p_user_id: id }, { get: true })
    .retry(false);
  throwIfError(error);
  const row = (data ?? [])[0] as ProfileRowData | undefined;
  return row ? toProfileView(client, row) : null;
}

/** Follows a public account (`active`) or asks a private one (`requested`). Repeating it changes nothing. */
export async function followUser(client: FinalMealClient, id: string): Promise<FollowState> {
  const { data, error } = await client.rpc('follow_user', { p_user_id: id });
  throwIfError(error);
  return toFollowState(data);
}

/** Unfollows, or cancels a pending request. Safe to repeat. */
export async function unfollowUser(client: FinalMealClient, id: string): Promise<void> {
  const { error } = await client.rpc('unfollow_user', { p_user_id: id });
  throwIfError(error);
}

/** Approves or declines a follow request made to the signed-in person. */
export async function respondToFollowRequest(
  client: FinalMealClient,
  followerId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await client.rpc('respond_follow_request', {
    p_follower_id: followerId,
    p_accept: accept,
  });
  throwIfError(error);
}

export interface PeopleListOptions {
  /** Matches a username prefix or a word of the display name. */
  q?: string;
  offset?: number;
  limit?: number;
}

/** Trims a search query and drops one leading `@`, so a handle typed as shown (`@ari`) matches. */
function cleanQuery(q: string | undefined): string {
  const text = (q ?? '').trim();
  return (text.startsWith('@') ? text.slice(1) : text).trim();
}

function listArgs(userId: string, opts: PeopleListOptions) {
  const q = cleanQuery(opts.q);
  return {
    p_user_id: userId,
    p_q: q ? q : undefined,
    p_offset: opts.offset ?? 0,
    p_limit: pageSize(opts.limit ?? DEFAULT_PAGE),
  };
}

/** The people who follow `userId`, newest first. Empty when the viewer may not see that list. */
export async function listFollowers(
  client: FinalMealClient,
  userId: string,
  opts: PeopleListOptions = {},
): Promise<PersonRow[]> {
  const { data, error } = await client
    .rpc('list_followers', listArgs(userId, opts), { get: true })
    .retry(false);
  throwIfError(error);
  return ((data ?? []) as PersonRowData[]).map((row) => toPersonRow(client, row));
}

/** The people `userId` follows, newest first. Empty when the viewer may not see that list. */
export async function listFollowing(
  client: FinalMealClient,
  userId: string,
  opts: PeopleListOptions = {},
): Promise<PersonRow[]> {
  const { data, error } = await client
    .rpc('list_following', listArgs(userId, opts), { get: true })
    .retry(false);
  throwIfError(error);
  return ((data ?? []) as PersonRowData[]).map((row) => toPersonRow(client, row));
}

/** Finds people by username prefix or a word of their name; a leading `@` is ignored. A blank query finds no one (and asks nothing). */
export async function searchPeople(
  client: FinalMealClient,
  q: string,
  limit = DEFAULT_PAGE,
): Promise<PersonRow[]> {
  const text = cleanQuery(q);
  if (text === '') return [];
  const { data, error } = await client
    .rpc('search_people', { p_q: text, p_limit: pageSize(limit) }, { get: true })
    .retry(false);
  throwIfError(error);
  return ((data ?? []) as PersonRowData[]).map((row) => toPersonRow(client, row));
}

/** People worth following: trusted, public, not already followed or asked; near the home city first. */
export async function getSuggestedPeople(
  client: FinalMealClient,
  limit?: number,
): Promise<SuggestedPerson[]> {
  const { data, error } = await client
    .rpc(
      'suggested_people',
      { p_limit: limit === undefined ? undefined : pageSize(limit) },
      { get: true },
    )
    .retry(false);
  throwIfError(error);
  return ((data ?? []) as Array<PersonRowData & { top_dish: string | null }>).map((row) => ({
    ...toPersonRow(client, row),
    topDish: row.top_dish,
  }));
}
