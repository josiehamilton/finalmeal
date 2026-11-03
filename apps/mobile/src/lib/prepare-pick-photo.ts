import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ApiError, looksLikeJpeg } from '@finalmeal/api';

export const PICK_PHOTO_MAX_SIDE = 1600;
export const PICK_PHOTO_QUALITY = 0.8;

/**
 * Privacy: this re-encode is what strips location and other EXIF metadata from a dish photo.
 * The image is decoded to pixels and written out again as a fresh JPEG (iOS `jpegData`, Android
 * `Bitmap.compress`), which carries no EXIF or GPS block. Every upload goes through here, so never
 * bypass it, never upload the picked file as it came, and never add a path that copies the
 * original's bytes. (expo-image-manipulator's `SaveOptions` has no `exif` switch to set; stripping
 * is simply what its save does. The server does not enforce this: a modified client could upload
 * its own metadata, which only exposes the uploader's own data.)
 *
 * Turns a picked dish photo into the bytes we upload: the longer side at most 1600 px (never
 * enlarged), JPEG at quality 0.8. As with avatars, the bytes are read with expo-file-system (a
 * `fetch` of a file:// URI fails on Android) and anything that is not a real JPEG is rejected.
 */
export async function preparePickPhoto(uri: string): Promise<ArrayBuffer> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const longest = Math.max(source.width, source.height);
  let image = source;
  if (longest > PICK_PHOTO_MAX_SIDE) {
    const resize =
      source.width >= source.height
        ? { width: PICK_PHOTO_MAX_SIDE }
        : { height: PICK_PHOTO_MAX_SIDE };
    image = await ImageManipulator.manipulate(source).resize(resize).renderAsync();
  }
  const saved = await image.saveAsync({ compress: PICK_PHOTO_QUALITY, format: SaveFormat.JPEG });
  const bytes = await new File(saved.uri).arrayBuffer();
  if (!looksLikeJpeg(bytes)) throw new ApiError('The prepared photo is not a JPEG', 'unknown');
  return bytes;
}
