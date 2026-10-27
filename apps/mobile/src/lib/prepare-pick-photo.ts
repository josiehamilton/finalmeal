import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ApiError, looksLikeJpeg } from '@finalmeal/api';

export const PICK_PHOTO_MAX_SIDE = 1600;
export const PICK_PHOTO_QUALITY = 0.8;

/**
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
