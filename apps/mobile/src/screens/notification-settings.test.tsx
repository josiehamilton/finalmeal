import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { getMyNotificationSettings, updateMyNotificationSettings } from '@finalmeal/api';
import NotificationSettingsScreen from '../../app/(app)/settings/notifications';
import { isPushAvailable } from '../lib/push';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyNotificationSettings: jest.fn(),
  updateMyNotificationSettings: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../lib/push', () => ({ isPushAvailable: jest.fn() }));
const mockGet = jest.mocked(getMyNotificationSettings);
const mockUpdate = jest.mocked(updateMyNotificationSettings);
const mockAvailable = jest.mocked(isPushAvailable);
const client = { fake: 'client' };

const ALL_ON = { dethroned: true, newFollowers: true, saves: true, friendsFinals: true };
const toggle = (name: string) => screen.getByRole('switch', { name });

async function show() {
  await render(<NotificationSettingsScreen />);
  await act(async () => {});
}

describe('Notification settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailable.mockReturnValue(false);
    mockGet.mockResolvedValue(ALL_ON);
    mockUpdate.mockResolvedValue(ALL_ON);
  });

  it('shows the Push section with the four switches, all on by default', async () => {
    await show();
    expect(screen.getByText('Notifications')).toBeOnTheScreen();
    expect(screen.getByText('Push')).toBeOnTheScreen();
    expect(
      screen.getByText('When someone you follow swaps a dish out of their five.'),
    ).toBeOnTheScreen();
    for (const name of [
      'Dethronings',
      'New followers',
      'Saves of your picks',
      'Friends’ new Final Meals',
    ]) {
      expect(toggle(name)).toBeChecked();
    }
    expect(screen.queryByText('Picks near you')).toBeNull();
    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByText('Weekly digest')).toBeNull();
  });

  it('shows what is saved', async () => {
    mockGet.mockResolvedValue({ ...ALL_ON, saves: false });
    await show();
    expect(toggle('Saves of your picks')).not.toBeChecked();
    expect(toggle('Dethronings')).toBeChecked();
  });

  it('saves a switch straight away, with only its own key', async () => {
    await show();
    mockUpdate.mockResolvedValue({ ...ALL_ON, newFollowers: false });
    await fireEvent.press(toggle('New followers'));
    expect(toggle('New followers')).not.toBeChecked();
    expect(mockUpdate).toHaveBeenCalledWith(client, { newFollowers: false });
    await act(async () => {});
    expect(toggle('New followers')).not.toBeChecked();
  });

  it('maps each switch to its key', async () => {
    await show();
    await fireEvent.press(toggle('Dethronings'));
    expect(mockUpdate).toHaveBeenLastCalledWith(client, { dethroned: false });
    await act(async () => {});
    await fireEvent.press(toggle('Saves of your picks'));
    expect(mockUpdate).toHaveBeenLastCalledWith(client, { saves: false });
    await act(async () => {});
    await fireEvent.press(toggle('Friends’ new Final Meals'));
    expect(mockUpdate).toHaveBeenLastCalledWith(client, { friendsFinals: false });
  });

  it('reverts that switch with friendly copy when the save fails', async () => {
    await show();
    mockUpdate.mockRejectedValue(new Error('offline'));
    await fireEvent.press(toggle('Dethronings'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen());
    expect(toggle('Dethronings')).toBeChecked();
    expect(toggle('New followers')).toBeChecked();
  });

  it('locks a switch while it saves, and leaves the others usable', async () => {
    await show();
    let finish: () => void = () => {};
    mockUpdate.mockReturnValueOnce(
      new Promise((resolve) => (finish = () => resolve({ ...ALL_ON, dethroned: false }))),
    );
    await fireEvent.press(toggle('Dethronings'));
    await fireEvent.press(toggle('Dethronings'));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    mockUpdate.mockResolvedValueOnce({ ...ALL_ON, saves: false });
    await fireEvent.press(toggle('Saves of your picks'));
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    await act(async () => finish());
    expect(toggle('Dethronings')).not.toBeChecked();
    expect(toggle('Saves of your picks')).not.toBeChecked();
  });

  it('saves once when a switch is tapped twice before the screen has redrawn', async () => {
    await show();
    mockUpdate.mockReturnValue(new Promise(() => {}));
    const dethroned = toggle('Dethronings');
    await act(async () => {
      fireEvent.press(dethroned);
      fireEvent.press(dethroned);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('shows the footer note while push is unavailable, and not once it is', async () => {
    const view = await render(<NotificationSettingsScreen />);
    await act(async () => {});
    const note =
      'Push notifications start with the first test build. Your choices are saved for then.';
    expect(screen.getByText(note)).toBeOnTheScreen();
    await view.unmount();
    mockAvailable.mockReturnValue(true);
    await show();
    expect(screen.queryByText(note)).toBeNull();
  });

  it('shows a spinner, then a problem with Try again when loading fails', async () => {
    let fail: (e: Error) => void = () => {};
    mockGet.mockReturnValueOnce(new Promise((_resolve, reject) => (fail = reject)));
    await render(<NotificationSettingsScreen />);
    expect(screen.getByTestId('settings-loading')).toBeOnTheScreen();
    await act(async () => fail(new Error('offline')));
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.queryByRole('switch')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {});
    expect(toggle('Dethronings')).toBeChecked();
  });

  it('goes back', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
