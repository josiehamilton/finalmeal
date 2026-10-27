import { isValidUsername } from '@finalmeal/core';
import type { FinalMealClient } from './client';
import { toCity } from './cities';
import type { CityRow } from './cities';
import type { Database } from './database.types';
import { ApiError, throwIfError } from './errors';

export interface MyProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  homeCity: { id: string; label: string } | null;
  showHomeCity: boolean;
  visibility: 'public' | 'private';
  onboarded: boolean;
  counts: { followers: number; following: number; dishes: number };
}

export interface ProfilePatch {
  displayName?: string;
  username?: string;
  /** An empty or blank bio clears it. */
  bio?: string | null;
  visibility?: 'public' | 'private';
  showHomeCity?: boolean;
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const AVATAR_BUCKET = 'avatars';

/** The signed-in person's id, from the stored session (no network round trip when it is still valid). */
export async function requireUserId(client: FinalMealClient): Promise<string> {
  const { data, error } = await client.auth.getSession();
  throwIfError(error);
  const id = data.session?.user.id;
  if (!id) throw new ApiError('Not signed in', 'not_authenticated');
  return id;
}

async function countRows(
  query: PromiseLike<{ count: number | null; error: { message: string; code: string } | null }>,
): Promise<number> {
  const { count, error } = await query;
  throwIfError(error);
  return count ?? 0;
}

/**
 * The signed-in person's profile with home city and counts, or null when signed out or when
 * no profile row exists yet (signed in, still onboarding).
 */
export async function getMyProfile(client: FinalMealClient): Promise<MyProfile | null> {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  throwIfError(sessionError);
  const uid = sessionData.session?.user.id;
  if (!uid) return null;

  const [profileResult, followers, following, dishes] = await Promise.all([
    client
      .from('profiles')
      .select('*, home_city:cities(*)')
      .eq('id', uid)
      .maybeSingle()
      .retry(false),
    countRows(
      client
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followee_id', uid)
        .eq('status', 'active')
        .retry(false),
    ),
    countRows(
      client
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', uid)
        .eq('status', 'active')
        .retry(false),
    ),
    countRows(
      client
        .from('picks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .retry(false),
    ),
  ]);
  throwIfError(profileResult.error);
  const row = profileResult.data as (ProfileRow & { home_city: CityRow | null }) | null;
  if (!row) return null;

  const homeCity = row.home_city ? toCity(row.home_city) : null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_path
      ? client.storage.from(AVATAR_BUCKET).getPublicUrl(row.avatar_path).data.publicUrl
      : null,
    homeCity: homeCity ? { id: homeCity.id, label: homeCity.label } : null,
    showHomeCity: row.show_home_city,
    visibility: row.visibility,
    onboarded: row.onboarded_at !== null,
    counts: { followers, following, dishes },
  };
}

/** Reads the profile after a write; a missing row means the person has not created one. */
export async function reloadMyProfile(client: FinalMealClient): Promise<MyProfile> {
  const profile = await getMyProfile(client);
  if (!profile) throw new ApiError('No profile for this account', 'profile_not_found');
  return profile;
}

/** True when nobody else holds the handle (your own handle counts as available to you). */
export async function isUsernameAvailable(
  client: FinalMealClient,
  username: string,
): Promise<boolean> {
  if (!isValidUsername(username)) return false;
  // GET, so the client's read timeout still bounds this call.
  const { data, error } = await client
    .rpc('is_username_available', { p_username: username }, { get: true })
    .retry(false);
  throwIfError(error);
  return data === true;
}

export async function createMyProfile(
  client: FinalMealClient,
  input: { displayName: string; username: string },
): Promise<MyProfile> {
  const { error } = await client.rpc('create_my_profile', {
    p_display_name: input.displayName.trim(),
    p_username: input.username,
  });
  throwIfError(error);
  return reloadMyProfile(client);
}

/** Postgres codes that mean the username was the problem, per spec 5.6. */
function throwProfileWriteError(error: { message: string; code: string } | null): void {
  if (!error) return;
  if (error.code === '23505') throw new ApiError(error.message, 'username_taken');
  if (error.code === '23514' && error.message.includes('profiles_username_check')) {
    throw new ApiError(error.message, 'invalid_username');
  }
  if (error.code === '23514' || error.code === '23502') {
    throw new ApiError(error.message, 'unknown');
  }
  throwIfError(error);
}

export async function updateMyProfile(
  client: FinalMealClient,
  patch: ProfilePatch,
): Promise<MyProfile> {
  const uid = await requireUserId(client);
  const row: Database['public']['Tables']['profiles']['Update'] = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName.trim();
  if (patch.username !== undefined) row.username = patch.username;
  if (patch.bio !== undefined)
    row.bio = patch.bio === null || patch.bio.trim() === '' ? null : patch.bio.trim();
  if (patch.visibility !== undefined) row.visibility = patch.visibility;
  if (patch.showHomeCity !== undefined) row.show_home_city = patch.showHomeCity;

  if (Object.keys(row).length > 0) {
    const { error } = await client.from('profiles').update(row).eq('id', uid);
    throwProfileWriteError(error);
  }
  return reloadMyProfile(client);
}

/** Sets the home city, or clears it with null. */
export async function setMyHomeCity(
  client: FinalMealClient,
  cityId: string | null,
): Promise<MyProfile> {
  // The SQL argument accepts null (it clears the city); the generated type just cannot say so.
  const { error } = await client.rpc('set_my_home_city', { p_city_id: cityId as string });
  throwIfError(error);
  return reloadMyProfile(client);
}

export async function finishOnboarding(client: FinalMealClient): Promise<MyProfile> {
  const { error } = await client.rpc('finish_onboarding');
  throwIfError(error);
  return reloadMyProfile(client);
}
