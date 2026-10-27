import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { finishOnboarding, uploadMyAvatar } from '@finalmeal/api';
import Photo from '../../app/(onboarding)/photo';
import { prepareAvatar } from '../lib/avatar';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  finishOnboarding: jest.fn(),
  uploadMyAvatar: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../lib/avatar', () => ({ prepareAvatar: jest.fn() }));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockFinish = jest.mocked(finishOnboarding);
const mockUpload = jest.mocked(uploadMyAvatar);
const mockPrepare = jest.mocked(prepareAvatar);
const mockCameraPermission = jest.mocked(ImagePicker.requestCameraPermissionsAsync);
const mockCamera = jest.mocked(ImagePicker.launchCameraAsync);
const mockLibrary = jest.mocked(ImagePicker.launchImageLibraryAsync);

const BYTES = new ArrayBuffer(8);
const DENIED = 'No problem. You can add a photo later from Edit profile.';
const cta = () => screen.getByRole('button', { name: 'Continue' });
const picked = (uri: string) => ({ canceled: false, assets: [{ uri }] }) as never;

describe('Photo step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFinish.mockResolvedValue({} as never);
    mockUpload.mockResolvedValue({} as never);
    mockPrepare.mockResolvedValue(BYTES);
    mockCameraPermission.mockResolvedValue({ granted: true } as never);
    mockCamera.mockResolvedValue(picked('file:///cam.jpg'));
    mockLibrary.mockResolvedValue(picked('file:///lib.jpg'));
  });

  it('shows the copy and both buttons', async () => {
    await render(<Photo />);
    expect(screen.getByText('Put a face to the plate.')).toBeOnTheScreen();
    expect(screen.getByText('Optional, but people follow faces.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Choose from library' })).toBeOnTheScreen();
  });

  it('Skip only finishes onboarding, then shows the loading screen', async () => {
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
  });

  it('Continue with no photo also just finishes', async () => {
    await render(<Photo />);
    await fireEvent.press(cta());
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
  });

  it('asks for a square crop from the library and uploads the prepared photo', async () => {
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
    expect(mockLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'] }),
    );
    expect(screen.getByLabelText('Your photo')).toBeOnTheScreen();
    await fireEvent.press(cta());
    expect(mockPrepare).toHaveBeenCalledWith('file:///lib.jpg');
    expect(mockUpload).toHaveBeenCalledWith({ fake: 'client' }, BYTES);
    expect(mockFinish).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
  });

  it('takes a photo with the camera after asking permission', async () => {
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(mockCamera).toHaveBeenCalledWith(
      expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }),
    );
    await fireEvent.press(cta());
    expect(mockPrepare).toHaveBeenCalledWith('file:///cam.jpg');
  });

  it('shows the no-problem copy when the camera is denied', async () => {
    mockCameraPermission.mockResolvedValue({ granted: false } as never);
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(screen.getByText(DENIED)).toBeOnTheScreen();
    expect(mockCamera).not.toHaveBeenCalled();
  });

  it('shows the same copy when the library cannot be opened', async () => {
    mockLibrary.mockRejectedValue(new Error('Permission denied'));
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
    expect(screen.getByText(DENIED)).toBeOnTheScreen();
  });

  it('ignores a cancelled picker', async () => {
    mockLibrary.mockResolvedValue({ canceled: true, assets: null } as never);
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
    expect(screen.queryByLabelText('Your photo')).toBeNull();
    await fireEvent.press(cta());
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('shows the friendly copy on failure, re-enables the buttons, and does not upload twice', async () => {
    mockFinish.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from library' }));
    await fireEvent.press(cta());
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(screen.queryByTestId('cta-busy')).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(cta());
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockFinish).toHaveBeenCalledTimes(2);
    expect(mockRouter.replace).toHaveBeenCalledWith('/loading');
  });

  it('goes back', async () => {
    await render(<Photo />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
