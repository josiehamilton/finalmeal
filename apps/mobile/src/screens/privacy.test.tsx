import { fireEvent, render, screen } from '@testing-library/react-native';
import { updateMyProfile } from '@finalmeal/api';
import Privacy from '../../app/(app)/settings/privacy';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  updateMyProfile: jest.fn(),
}));
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
const mockUpdate = jest.mocked(updateMyProfile);

const publicCard = () => screen.getByRole('radio', { name: /^Public/ });
const privateCard = () => screen.getByRole('radio', { name: /^Private/ });
const homeCitySwitch = () => screen.getByRole('switch', { name: 'Show my home city' });

describe('Privacy & safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile = makeProfile();
    mockUpdate.mockResolvedValue(makeProfile());
    mockRefresh.mockResolvedValue(null);
  });

  it('shows the decided copy', async () => {
    await render(<Privacy />);
    expect(screen.getByText('Privacy & safety')).toBeOnTheScreen();
    expect(screen.getByText('Profile visibility')).toBeOnTheScreen();
    for (const line of [
      'Anyone can see your profile, picks and lists',
      'People can follow you straight away',
      'People can still find you by name',
      'Your picks, lists and home city are only for followers you approve',
      'Your picks still help the map, without your name',
      'Lists you share by link still show you',
      'Everyone starts public.',
      'Shown on your profile.',
    ]) {
      expect(screen.getByText(line)).toBeOnTheScreen();
    }
    expect(screen.queryByText('Safety')).toBeNull();
    expect(screen.queryByText('Your data')).toBeNull();
  });

  it('reflects the saved visibility and home-city setting', async () => {
    mockProfile = makeProfile({ visibility: 'private', showHomeCity: false });
    await render(<Privacy />);
    expect(privateCard()).toBeChecked();
    expect(publicCard()).not.toBeChecked();
    expect(homeCitySwitch().props.value).toBe(false);
  });

  it('saves Private at once, then reloads the profile', async () => {
    await render(<Privacy />);
    expect(publicCard()).toBeChecked();
    await fireEvent.press(privateCard());
    expect(mockUpdate).toHaveBeenCalledWith({ fake: 'client' }, { visibility: 'private' });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(privateCard()).toBeChecked();
  });

  it('shows Private straight away, before the save finishes', async () => {
    let finish: (() => void) | undefined;
    mockUpdate.mockReturnValue(new Promise((resolve) => (finish = () => resolve(makeProfile()))));
    await render(<Privacy />);
    await fireEvent.press(privateCard());
    expect(privateCard()).toBeChecked();
    finish?.();
  });

  it('rolls back and shows friendly copy when the save fails', async () => {
    mockUpdate.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Privacy />);
    await fireEvent.press(privateCard());
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(publicCard()).toBeChecked();
    expect(privateCard()).not.toBeChecked();
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does not save when the chosen card is already selected', async () => {
    await render(<Privacy />);
    await fireEvent.press(publicCard());
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves the home-city toggle, and rolls it back on failure', async () => {
    await render(<Privacy />);
    await fireEvent(homeCitySwitch(), 'valueChange', false);
    expect(mockUpdate).toHaveBeenCalledWith({ fake: 'client' }, { showHomeCity: false });
    expect(homeCitySwitch().props.value).toBe(false);

    mockUpdate.mockRejectedValue(new TypeError('Network request failed'));
    await fireEvent(homeCitySwitch(), 'valueChange', true);
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    expect(homeCitySwitch().props.value).toBe(false);
  });

  it('keeps the saved choice when only the reload fails', async () => {
    mockRefresh.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Privacy />);
    await fireEvent.press(privateCard());
    expect(privateCard()).toBeChecked();
    expect(screen.queryByText('Can’t reach the kitchen right now.')).toBeNull();
  });

  it('goes back', async () => {
    await render(<Privacy />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
