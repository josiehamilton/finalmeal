import type { FinalMealClient } from './client';
import type { Database } from './database.types';
import { throwIfError } from './errors';

export type TagKind = 'food_type' | 'dietary' | 'personal';

export interface Tag {
  id: string;
  kind: TagKind;
  name: string;
  slug: string;
  /** True for the curated tags shown first in the Popular list. */
  featured: boolean;
}

/** The columns of a `tags` row that the app reads. */
export interface TagRow {
  id: string;
  kind: Database['public']['Enums']['tag_kind'];
  name: string;
  slug: string;
  is_featured: boolean;
}

export function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
    featured: row.is_featured,
  };
}

/**
 * Tag type-ahead for one kind. A blank query returns the Popular list (featured tags, or the
 * person's own tags for `personal`). Personal tags found are only ever the caller's own.
 */
export async function searchTags(
  client: FinalMealClient,
  kind: TagKind,
  q: string,
  limit = 10,
): Promise<Tag[]> {
  // GET, so the client's read timeout still bounds this call.
  const { data, error } = await client
    .rpc('search_tags', { p_kind: kind, p_q: q.trim(), p_lim: limit }, { get: true })
    .retry(false);
  throwIfError(error);
  return (data ?? []).map(toTag);
}

/**
 * Creates one of the person's own tags, or returns the one they already have with that name
 * (the same tag when its slug is the same: "Rainy day" and "rainy  DAY"). Names are 1-40
 * characters, otherwise `invalid_tag_name`.
 */
export async function createPersonalTag(client: FinalMealClient, name: string): Promise<Tag> {
  const { data, error } = await client.rpc('create_personal_tag', { p_name: name });
  throwIfError(error);
  return toTag(data as TagRow);
}
