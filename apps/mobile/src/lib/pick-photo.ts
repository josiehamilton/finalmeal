import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'camera' | 'library';

export type PickResult =
  | { status: 'picked'; uri: string }
  | { status: 'canceled' }
  /** No permission, or no camera: treated as a gentle "no", never as an error. */
  | { status: 'denied' };

const PICKER_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
} satisfies ImagePicker.ImagePickerOptions;

/** The profile-photo picker shared by onboarding and Edit profile (square crop, then prepareAvatar). */
export async function pickPhoto(source: PhotoSource): Promise<PickResult> {
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: 'denied' };
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
        : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    const uri = result.canceled ? undefined : result.assets[0]?.uri;
    return uri ? { status: 'picked', uri } : { status: 'canceled' };
  } catch {
    return { status: 'denied' };
  }
}
