import type { FinalMealClient } from './client';
import { ApiError, throwIfError } from './errors';
import { AVATAR_BUCKET, reloadMyProfile, requireUserId } from './profile';
import type { MyProfile } from './profile';

/**
 * Uploads a JPEG as the person's avatar and returns their updated profile. The file name
 * carries the upload time (`<uid>/avatar-<ms>.jpg`), so a new picture always has a new
 * address and no cache can show the old one. The previous file is removed on a best-effort basis.
 */
export async function uploadMyAvatar(
  client: FinalMealClient,
  bytes: ArrayBuffer,
): Promise<MyProfile> {
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
