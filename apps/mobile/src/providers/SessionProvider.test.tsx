import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { getMyProfile } from '@finalmeal/api';
import type { FinalMealClient, MyProfile } from '@finalmeal/api';
import { SessionProvider, useSession } from './SessionProvider';
import type { SessionState } from './SessionProvider';

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
  let current = initial;
  const unsubscribe = jest.fn();
  const client = {
    auth: {
      getSession: async () => ({ data: { session: current }, error: null }),
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        cb('INITIAL_SESSION', initial);
        return { data: { subscription: { unsubscribe } } };
      },
    },
  } as unknown as FinalMealClient;
  return {
    client,
    emit: (event: string, s: unknown) => {
      current = s;
      listener(event, s);
    },
    unsubscribe,
  };
}

const SESSION = { user: { id: 'u1' } };

let latest: SessionState;

function Probe() {
  latest = useSession();
  const { session, profile, loading, error, refreshProfile } = latest;
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
      <Pressable testID="refresh" onPress={() => refreshProfile().catch(() => {})} />
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

  it('refreshProfile finds the profile in the same tick as a sign-in', async () => {
    mockGetMyProfile.mockResolvedValue(PROFILE);
    const { client, emit } = fakeClient(null);
    await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().loading).toBe(false));

    let refreshed: Promise<MyProfile | null> | undefined;
    await act(async () => {
      emit('SIGNED_IN', SESSION);
      // Before React has rendered the new session.
      refreshed = latest.refreshProfile();
    });
    await expect(refreshed).resolves.toEqual(PROFILE);
    await waitFor(() => expect(state().profile).toBe('josie'));
  });

  it('refreshProfile resolves null when signed in but no profile exists yet', async () => {
    mockGetMyProfile.mockResolvedValue(null);
    const { client } = fakeClient(SESSION);
    await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().loading).toBe(false));
    await expect(latest.refreshProfile()).resolves.toBeNull();
    expect(state().error).toBeNull();
  });

  it('refreshProfile rejects, rather than resolving null, when the load fails', async () => {
    mockGetMyProfile.mockResolvedValueOnce(PROFILE);
    const { client } = fakeClient(SESSION);
    await render(
      <SessionProvider client={client}>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(state().profile).toBe('josie'));

    mockGetMyProfile.mockRejectedValueOnce(new TypeError('fetch failed'));
    let failure: unknown;
    await act(async () => {
      await latest.refreshProfile().catch((e: unknown) => (failure = e));
    });
    expect(failure).toBeInstanceOf(TypeError);
    expect(state().error).toBe('Can’t reach the kitchen right now.');
    // The last good profile is kept.
    expect(state().profile).toBe('josie');
  });
});
