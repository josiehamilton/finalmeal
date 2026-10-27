import type { FinalMealClient } from './client';
import { ApiError, throwIfError } from './errors';
import { AVATAR_BUCKET, reloadMyProfile, requireUserId } from './profile';
import type { MyProfile } from './profile';

/** Smallest buffer we accept as a photo. A real 512x512 JPEG is tens of kilobytes. */
export const MIN_AVATAR_BYTES = 100;

/** True when `bytes` is plausibly a JPEG: at least `MIN_AVATAR_BYTES` long and starting FF D8. */
export function looksLikeJpeg(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < MIN_AVATAR_BYTES) return false;
  const head = new Uint8Array(bytes, 0, 2);
  return head[0] === 0xff && head[1] === 0xd8;
}

/**
 * Uploads a JPEG as the person's avatar and returns their updated profile. The file name
 * carries the upload time (`<uid>/avatar-<ms>.jpg`), so a new picture always has a new
 * address and no cache can show the old one. The previous file is removed on a best-effort basis.
 * Anything that is not a real JPEG (for example an error body read from a missing file) is
 * rejected as `unknown` before any request is made.
 */
export async function uploadMyAvatar(
  client: FinalMealClient,
  bytes: ArrayBuffer,
): Promise<MyProfile> {
  if (!looksLikeJpeg(bytes)) throw new ApiError('Not a JPEG image', 'unknown');
  const uid = await requireUserId(client);
  const { data: current, error: readError } = await client
    .from('profiles')
    .select('avatar_path')
    .eq('id', uid)
    .maybeSingle()
    .retry(false);
  throwIfError(readError);
  if (!current) throw new ApiError('No profile for this account', 'profile_not_found');

  const path = `${uid}/avatar-${Date.now()}.jpg`;
  const bucket = client.storage.from(AVATAR_BUCKET);
  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  throwIfError(uploadError);

  const { error: updateError } = await client
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', uid);
  if (updateError) {
    await bucket.remove([path]).catch(() => undefined); // don't leave an orphan behind
    throwIfError(updateError);
  }

  if (current.avatar_path && current.avatar_path !== path) {
    await bucket.remove([current.avatar_path]).catch(() => undefined);
  }
  return reloadMyProfile(client);
}
