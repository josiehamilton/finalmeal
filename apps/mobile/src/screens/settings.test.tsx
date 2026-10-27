import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { AlertButton } from 'react-native';
import { signOut } from '@finalmeal/api';
import Settings from '../../app/(app)/settings/index';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  signOut: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));
const mockSignOut = jest.mocked(signOut);

function confirmButtons(): AlertButton[] {
  const spy = jest.spyOn(Alert, 'alert');
  return spy.mock.calls[0]?.[2] ?? [];
}

describe('Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockProfile = makeProfile();
    mockSignOut.mockResolvedValue(undefined);
  });

  it('lists the Account and Preferences rows, and nothing for later phases', async () => {
    await render(<Settings />);
    expect(screen.getByText('Settings')).toBeOnTheScreen();
    expect(screen.getByText('Account')).toBeOnTheScreen();
    expect(screen.getByText('Preferences')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Edit profile/ })).toBeOnTheScreen();
    expect(screen.getByText('Sign-in method')).toBeOnTheScreen();
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Privacy & safety/ })).toBeOnTheScreen();
    for (const hidden of [
      'Remove ads',
      'Notifications',
      'Help & feedback',
      'Terms of Service',
      'Privacy Policy',
    ]) {
      expect(screen.queryByText(hidden)).toBeNull();
    }
  });

  it('shows the version in the footer', async () => {
    await render(<Settings />);
    expect(screen.getByText('Final Meal · version 0.1.0')).toBeOnTheScreen();
  });

  it('shows the home city, or Not set', async () => {
    const view = await render(<Settings />);
    expect(screen.getByText('Vancouver, BC, Canada')).toBeOnTheScreen();
    await view.unmount();
    mockProfile = makeProfile({ homeCity: null });
    await render(<Settings />);
    expect(screen.getByText('Not set')).toBeOnTheScreen();
  });

  it('opens the other settings screens', async () => {
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: /Edit profile/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings/edit-profile');
    await fireEvent.press(screen.getByRole('button', { name: /Privacy & safety/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings/privacy');
    await fireEvent.press(screen.getByRole('button', { name: /Home city/ }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/settings/home-city');
  });

  it('goes back', async () => {
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('asks before logging out, and Cancel does nothing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]?.[0]).toBe('Log out of Final Meal?');
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Log out']);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs out when Log out is confirmed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    const logOut = confirmButtons().find((b) => b.text === 'Log out');
    await logOut?.onPress?.();
    expect(mockSignOut).toHaveBeenCalledWith({ fake: 'client' });
  });

  it('shows friendly copy when signing out fails', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockSignOut.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Settings />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log out' }));
    const logOut = confirmButtons().find((b) => b.text === 'Log out');
    await logOut?.onPress?.();
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
  });
});
