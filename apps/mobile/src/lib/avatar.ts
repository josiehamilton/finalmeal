import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const AVATAR_SIZE = 512;
export const AVATAR_QUALITY = 0.8;

/**
 * Turns a picked photo into the bytes we upload: a centred square, 512×512, JPEG at quality 0.8.
 * The picker already crops to a square, but not every device honours that, so we square it here too.
 */
export async function prepareAvatar(uri: string): Promise<ArrayBuffer> {
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const side = Math.min(source.width, source.height);
  const squared = await ImageManipulator.manipulate(source)
    .crop({
      originX: Math.floor((source.width - side) / 2),
      originY: Math.floor((source.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();
  const saved = await squared.saveAsync({ compress: AVATAR_QUALITY, format: SaveFormat.JPEG });
  const response = await fetch(saved.uri);
  return response.arrayBuffer();
}
