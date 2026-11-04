import type { FeedKind } from '@finalmeal/core';
import type { FinalMealClient } from './client';
import { throwIfError } from './errors';
import { pageSize, toPersonSummary } from './people';
import type { PersonSummary } from './people';
import { photoUrlFor, toPickFromColumns } from './picks';
import type { Pick, PickColumns } from './picks';

export type { FeedKind } from '@finalmeal/core';

/** One card in the Following or Nearby feed. */
export interface FeedItem {
  /** Unique within a feed (the activity id, or the pick id in Nearby). */
  key: string;
  kind: FeedKind;
  /** When it happened. */
  at: string;
  actor: PersonSummary;
  /**
   * The pick on the card. Its tags are the global ones only, `originalDishName` is the dish's
   * name, and `createdAt` is `at`.
   */
  pick: Pick;
  /** For a `dethroned` card: the dish that lost its place. */
  otherDishName: string | null;
  /** How many people have this dish on a list. */
  listCount: number;
  savedByMe: boolean;
}

/** Where the next page of the Following feed starts: the last card's `at` and `key`. */
export interface FeedCursor {
  before: string;
  beforeKey: string;
}

const DEFAULT_PAGE = 20;

interface FeedRow extends Omit<PickColumns, 'original_dish_name' | 'created_at'> {
  item_key: string;
  kind: string;
  at: string;
  actor_id: string;
  actor_username: string;
  actor_display_name: string;
  actor_avatar_path: string | null;
  other_dish_name: string | null;
  list_count: number;
  saved_by_me: boolean;
}

export function toFeedItem(client: FinalMealClient, row: FeedRow): FeedItem {
  return {
    key: row.item_key,
    kind: row.kind as FeedKind,
    at: row.at,
    actor: toPersonSummary(client, {
      id: row.actor_id,
      username: row.actor_username,
      display_name: row.actor_display_name,
      avatar_path: row.actor_avatar_path,
    }),
    pick: toPickFromColumns(
      { ...row, original_dish_name: row.dish_name, created_at: row.at },
      photoUrlFor(client),
    ),
    otherDishName: row.other_dish_name,
    listCount: row.list_count,
    savedByMe: row.saved_by_me,
  };
}

/**
 * What the people the signed-in person follows have been doing, newest first. A swap shows once,
 * as the `dethroned` card. Pass the previous page's `next` to continue; `next` is null once a
 * page comes back short.
 */
export async function getFollowingFeed(
  client: FinalMealClient,
  cursor?: FeedCursor,
  limit = DEFAULT_PAGE,
): Promise<{ items: FeedItem[]; next: FeedCursor | null }> {
  const size = pageSize(limit);
  const { data, error } = await client
    .rpc(
      'following_feed',
      { p_before: cursor?.before, p_before_key: cursor?.beforeKey, p_limit: size },
      { get: true },
    )
    .retry(false);
  throwIfError(error);
  const items = ((data ?? []) as unknown as FeedRow[]).map((row) => toFeedItem(client, row));
  const last = items[items.length - 1];
  return {
    items,
    next: last && items.length >= size ? { before: last.at, beforeKey: last.key } : null,
  };
}

/**
 * Picks near the signed-in person's chosen home city (never their phone's position), ranked by
 * recency and how many people have the dish. Empty without a home city. `nextOffset` is null
 * once a page comes back short.
 */
export async function getNearbyFeed(
  client: FinalMealClient,
  offset = 0,
  limit = DEFAULT_PAGE,
): Promise<{ items: FeedItem[]; nextOffset: number | null }> {
  const size = pageSize(limit);
  const { data, error } = await client
    .rpc('nearby_feed', { p_offset: offset, p_limit: size }, { get: true })
    .retry(false);
  throwIfError(error);
  const items = ((data ?? []) as unknown as FeedRow[]).map((row) => toFeedItem(client, row));
  return { items, nextOffset: items.length >= size && size > 0 ? offset + items.length : null };
}

/**
 * Who else has something at this spot: how many trusted people other than the signed-in person
 * have a pick there, and up to three public ones to show.
 */
export async function getPlacePickers(
  client: FinalMealClient,
  placeId: string,
): Promise<{ otherCount: number; people: PersonSummary[] }> {
  const { data, error } = await client
    .rpc('place_pickers', { p_place_id: placeId }, { get: true })
    .retry(false);
  throwIfError(error);
  const row = (data ?? [])[0] as
    | {
        other_count: number;
        people: Array<{
          id: string;
          username: string;
          display_name: string;
          avatar_path: string | null;
        }>;
      }
    | undefined;
  return {
    otherCount: row?.other_count ?? 0,
    people: (row?.people ?? []).map((p) => toPersonSummary(client, p)),
  };
}
