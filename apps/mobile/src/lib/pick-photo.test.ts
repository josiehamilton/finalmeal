import * as ImagePicker from 'expo-image-picker';
import { pickPhoto } from './pick-photo';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
const mockLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync);

describe('pickPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] } as never);
  });

  it('crops to a square by default (profile photos)', async () => {
    await expect(pickPhoto('library')).resolves.toEqual({ status: 'picked', uri: 'file:///a.jpg' });
    expect(mockLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }),
    );
  });

  it('keeps the whole picture for dish photos', async () => {
    await pickPhoto('library', { crop: false });
    expect(mockLibrary).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
  });

  it('treats a canceled pick as canceled', async () => {
    mockLibrary.mockResolvedValue({ canceled: true, assets: null } as never);
    await expect(pickPhoto('library')).resolves.toEqual({ status: 'canceled' });
  });
});
