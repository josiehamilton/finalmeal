import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';
import { isUsernameAvailable, updateMyProfile, uploadMyAvatar } from '@finalmeal/api';
import EditProfile from '../../app/(app)/settings/edit-profile';
import { prepareAvatar } from '../lib/avatar';
import { pickPhoto } from '../lib/pick-photo';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  isUsernameAvailable: jest.fn(),
  updateMyProfile: jest.fn(),
  uploadMyAvatar: jest.fn(),
}));
jest.mock('../lib/avatar', () => ({ prepareAvatar: jest.fn() }));
jest.mock('../lib/pick-photo', () => ({ pickPhoto: jest.fn() }));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockRefresh = jest.fn();
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: false,
    error: null,
    refreshProfile: mockRefresh,
  }),
}));
const mockAvailable = jest.mocked(isUsernameAvailable);
const mockUpdate = jest.mocked(updateMyProfile);
const mockUpload = jest.mocked(uploadMyAvatar);
const mockPrepare = jest.mocked(prepareAvatar);
const mockPick = jest.mocked(pickPhoto);

const TAKEN = 'That handle’s taken. Try another.';
const BYTES = new ArrayBuffer(8);
const save = () => screen.getByRole('button', { name: 'Save' });

async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
async function typeInto(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}
async function choosePhotoSource(text: string) {
  const alert = jest.spyOn(Alert, 'alert');
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  await act(async () => {
    await buttons.find((b) => b.text === text)?.onPress?.();
  });
}

describe('Edit profile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockProfile = makeProfile();
    mockAvailable.mockResolvedValue(true);
    mockUpdate.mockResolvedValue(makeProfile());
    mockUpload.mockResolvedValue(makeProfile());
    mockPrepare.mockResolvedValue(BYTES);
    mockRefresh.mockResolvedValue(null);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the current values and the bio counter', async () => {
    await render(<EditProfile />);
    expect(screen.getByText('Edit profile')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name').props.value).toBe('Josie Hamilton');
    expect(screen.getByLabelText('Username').props.value).toBe('josiehamilton');
    expect(screen.getByText('@')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bio').props.value).toBe('Chasing the perfect meal.');
    expect(screen.getByText('25 / 100')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Home city/ })).toBeOnTheScreen();
    expect(screen.getByText('Vancouver, BC, Canada')).toBeOnTheScreen();
  });

  it('limits the name to 60 and the bio to 100 characters, and updates the counter', async () => {
    await render(<EditProfile />);
    expect(screen.getByLabelText('Name').props.maxLength).toBe(60);
    expect(screen.getByLabelText('Bio').props.maxLength).toBe(100);
    await typeInto('Bio', 'Soup.');
    expect(screen.getByText('5 / 100')).toBeOnTheScreen();
  });

  it('keeps Save disabled until something changes, and again if it is changed back', async () => {
    await render(<EditProfile />);
    expect(save()).toBeDisabled();
    await typeInto('Name', 'Josie H');
    expect(save()).toBeEnabled();
    await typeInto('Name', 'Josie Hamilton');
    expect(save()).toBeDisabled();
  });

  it('keeps Save disabled for an empty name', async () => {
    await render(<EditProfile />);
    await typeInto('Name', '   ');
    expect(save()).toBeDisabled();
  });

  it('does not check availability when the username is unchanged', async () => {
    await render(<EditProfile />);
    await tick(1000);
    expect(mockAvailable).not.toHaveBeenCalled();
    expect(screen.queryByText('Available')).toBeNull();
  });

  it('checks a changed username and shows Available', async () => {
    await render(<EditProfile />);
    await typeInto('Username', 'josie_h');
    await tick(400);
    expect(mockAvailable).toHaveBeenCalledWith({ fake: 'client' }, 'josie_h');
    expect(screen.getByText('Available')).toBeOnTheScreen();
    expect(save()).toBeEnabled();
  });

  it('blocks Save when the username is taken', async () => {
    mockAvailable.mockResolvedValue(false);
    await render(<EditProfile />);
    await typeInto('Username', 'josie_h');
    await tick(400);
    expect(screen.getByText(TAKEN)).toBeOnTheScreen();
    expect(save()).toBeDisabled();
  });

  it('blocks Save for an invalid username', async () => {
    await render(<EditProfile />);
    await typeInto('Username', 'a!');
    expect(
      screen.getByText('Letters, numbers and underscores, 3–30 characters.'),
    ).toBeOnTheScreen();
    expect(save()).toBeDisabled();
  });

  it('saves only what changed, reloads the profile and goes back', async () => {
    await render(<EditProfile />);
    await typeInto('Name', 'Josie H');
    await typeInto('Bio', 'Soup.');
    await fireEvent.press(save());
    expect(mockUpdate).toHaveBeenCalledWith(
      { fake: 'client' },
      { displayName: 'Josie H', bio: 'Soup.' },
    );
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('saves a new username', async () => {
    await render(<EditProfile />);
    await typeInto('Username', 'josie_h');
    await tick(400);
    await fireEvent.press(save());
    expect(mockUpdate).toHaveBeenCalledWith({ fake: 'client' }, { username: 'josie_h' });
  });

  it('clears the bio when it is emptied', async () => {
    await render(<EditProfile />);
    await typeInto('Bio', '');
    await fireEvent.press(save());
    expect(mockUpdate).toHaveBeenCalledWith({ fake: 'client' }, { bio: null });
  });

  it('shows friendly copy and stays when the save fails', async () => {
    mockUpdate.mockRejectedValue(new TypeError('Network request failed'));
    await render(<EditProfile />);
    await typeInto('Name', 'Josie H');
    await fireEvent.press(save());
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
  });

  it('turns a taken-handle answer from the server into the taken state', async () => {
    const { ApiError } = jest.requireActual<typeof import('@finalmeal/api')>('@finalmeal/api');
    mockUpdate.mockRejectedValue(new ApiError('taken', 'username_taken'));
    await render(<EditProfile />);
    await typeInto('Username', 'josie_h');
    await tick(400);
    await fireEvent.press(save());
    expect(screen.getByText(TAKEN)).toBeOnTheScreen();
    expect(screen.queryByText('Available')).toBeNull();
    expect(save()).toBeDisabled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('opens the home city screen', async () => {
    await render(<EditProfile />);
    await fireEvent.press(screen.getByRole('button', { name: /Home city/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/home-city');
  });

  it('picks a photo, and uploads it on Save, not before', async () => {
    mockPick.mockResolvedValue({ status: 'picked', uri: 'file:///new.jpg' });
    await render(<EditProfile />);
    await fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));
    await choosePhotoSource('Choose from library');
    expect(mockPick).toHaveBeenCalledWith('library');
    expect(screen.getByLabelText('Your new photo')).toBeOnTheScreen();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(save()).toBeEnabled();
    await fireEvent.press(save());
    expect(mockPrepare).toHaveBeenCalledWith('file:///new.jpg');
    expect(mockUpload).toHaveBeenCalledWith({ fake: 'client' }, BYTES);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('does not upload the same photo twice when a later step fails and Save is retried', async () => {
    mockPick.mockResolvedValue({ status: 'picked', uri: 'file:///new.jpg' });
    mockUpdate.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(<EditProfile />);
    await typeInto('Name', 'Josie H');
    await fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));
    await choosePhotoSource('Take a photo');
    await fireEvent.press(save());
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    await fireEvent.press(save());
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('says so gently when the camera or photos are off limits', async () => {
    mockPick.mockResolvedValue({ status: 'denied' });
    await render(<EditProfile />);
    await fireEvent.press(screen.getByRole('button', { name: 'Change photo' }));
    await choosePhotoSource('Take a photo');
    expect(
      screen.getByText('No problem. You can change your photo any time from here.'),
    ).toBeOnTheScreen();
    expect(save()).toBeDisabled();
  });

  it('goes back without saving', async () => {
    await render(<EditProfile />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
