import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'camera' | 'library';

export type PickResult =
  | { status: 'picked'; uri: string }
  | { status: 'canceled' }
  /** No permission, or no camera: treated as a gentle "no", never as an error. */
  | { status: 'denied' };

/** Profile photos: a square crop. */
const SQUARE_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
} satisfies ImagePicker.ImagePickerOptions;

/** Dish photos: the whole picture, no forced crop (it is resized to 1600 px when saving). */
const UNCROPPED_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 1,
} satisfies ImagePicker.ImagePickerOptions;

/**
 * The photo picker. By default it is the profile-photo picker shared by onboarding and Edit
 * profile (square crop, then prepareAvatar); pass `{ crop: false }` for dish photos.
 */
export async function pickPhoto(
  source: PhotoSource,
  { crop = true }: { crop?: boolean } = {},
): Promise<PickResult> {
  const options = crop ? SQUARE_OPTIONS : UNCROPPED_OPTIONS;
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: 'denied' };
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    const uri = result.canceled ? undefined : result.assets[0]?.uri;
    return uri ? { status: 'picked', uri } : { status: 'canceled' };
  } catch {
    return { status: 'denied' };
  }
}
