import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { getMyProfile } from '@finalmeal/api';
import type { FinalMealClient, MyProfile } from '@finalmeal/api';
import { SessionProvider, useSession } from './SessionProvider';

jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyProfile: jest.fn(),
}));
const mockGetMyProfile = jest.mocked(getMyProfile);

const PROFILE: MyProfile = {
  id: 'u1',
  username: 'josie',
  displayName: 'Josie',
  bio: null,
  avatarUrl: null,
  homeCity: null,
  showHomeCity: true,
  visibility: 'public',
  onboarded: true,
  counts: { followers: 0, following: 0, dishes: 0 },
};

type Listener = (event: string, session: unknown) => void;

function fakeClient(initial: unknown) {
  let listener: Listener = () => {};
  const unsubscribe = jest.fn();
  const client = {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        cb('INITIAL_SESSION', initial);
        return { data: { subscription: { unsubscribe } } };
      },
    },
  } as unknown as FinalMealClient;
  return { client, emit: (event: string, s: unknown) => listener(event, s), unsubscribe };
}

const SESSION = { user: { id: 'u1' } };

function Probe() {
  const { session, profile, loading, error, refreshProfile } = useSession();
  return (
    <>
      <Text testID="state">
        {JSON.stringify({
          session: session !== null,
          profile: profile?.username ?? null,
          loading,
          error,
        })}
      </Text>
      <Pressable testID="refresh" onPress={() => void refreshProfile()} />
    </>
  );
}

const state = () => JSON.parse(String(screen.getByTestId('state').props.children));

describe('SessionProvider', () => {
  beforeEach(() => mockGetMyProfile.mockReset());

  it('is loading, then exposes the profile for a signed-in person', async () => {
    mockGetMyProfile.mockResolvedValue(PROFILE);
    const { client } = fakeClient(SESSION);
    await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().loading).toBe(false));
    expect(state()).toEqual({ session: true, profile: 'josie', loading: false, error: null });
  });

  it('is not loading, with no session, when signed out', async () => {
    const { client } = fakeClient(null);
    await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().loading).toBe(false));
    expect(state()).toEqual({ session: false, profile: null, loading: false, error: null });
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });

  it('exposes a friendly message when the profile cannot be loaded', async () => {
    mockGetMyProfile.mockRejectedValue(new TypeError('fetch failed'));
    const { client } = fakeClient(SESSION);
    await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().loading).toBe(false));
    expect(state().error).toBe('Can’t reach the kitchen right now.');
    expect(state().profile).toBeNull();
    expect(state().session).toBe(true);
  });

  it('clears the error when a later refresh succeeds', async () => {
    mockGetMyProfile.mockRejectedValueOnce(new TypeError('fetch failed'));
    mockGetMyProfile.mockResolvedValueOnce(PROFILE);
    const { client } = fakeClient(SESSION);
    await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().error).not.toBeNull());
    await fireEvent.press(screen.getByTestId('refresh'));
    await waitFor(() => expect(state().profile).toBe('josie'));
    expect(state().error).toBeNull();
  });

  it('drops the profile when the session ends, and unsubscribes on unmount', async () => {
    mockGetMyProfile.mockResolvedValue(PROFILE);
    const { client, emit, unsubscribe } = fakeClient(SESSION);
    const view = await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().profile).toBe('josie'));
    await act(async () => emit('SIGNED_OUT', null));
    expect(state()).toEqual({ session: false, profile: null, loading: false, error: null });
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
