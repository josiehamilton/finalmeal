import { act, render, waitFor } from '@testing-library/react-native';
import type { FinalMealClient } from '@finalmeal/api';
import { SessionProvider } from '../providers/SessionProvider';
import { SignedOutGuard } from './SignedOutGuard';

const mockReplace = jest.fn();
let mockSegments: string[] = [];
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyProfile: jest.fn().mockResolvedValue(null),
}));

type Listener = (event: string, session: unknown) => void;

function fakeClient(initial: unknown) {
  let listener: Listener = () => {};
  const client = {
    auth: {
      getSession: async () => ({ data: { session: initial }, error: null }),
      getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
      onAuthStateChange: (cb: Listener) => {
        listener = cb;
        cb('INITIAL_SESSION', initial);
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  } as unknown as FinalMealClient;
  return { client, emit: (event: string, s: unknown) => listener(event, s) };
}

const SESSION = { user: { id: 'u1' } };

async function mountSignedIn(segments: string[]) {
  mockSegments = segments;
  const fake = fakeClient(SESSION);
  await render(
    <SessionProvider client={fake.client}>
      <SignedOutGuard />
    </SessionProvider>,
  );
  await waitFor(() => expect(mockReplace).not.toHaveBeenCalled());
  return fake;
}

describe('SignedOutGuard', () => {
  beforeEach(() => mockReplace.mockClear());

  it('sends the person to Welcome when the session ends on an onboarding screen', async () => {
    const { emit } = await mountSignedIn(['(onboarding)', 'city']);
    await act(async () => emit('SIGNED_OUT', null));
    expect(mockReplace).toHaveBeenCalledWith('/welcome');
  });

  it('does the same inside the app', async () => {
    const { emit } = await mountSignedIn(['(app)', 'you']);
    await act(async () => emit('SIGNED_OUT', null));
    expect(mockReplace).toHaveBeenCalledWith('/welcome');
  });

  it('leaves the sign-in screens alone', async () => {
    for (const screen of ['welcome', 'email', 'code']) {
      const { emit } = await mountSignedIn(['(onboarding)', screen]);
      await act(async () => emit('SIGNED_OUT', null));
    }
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does nothing for a visitor who was never signed in', async () => {
    mockSegments = [];
    await render(
      <SessionProvider client={fakeClient(null).client}>
        <SignedOutGuard />
      </SessionProvider>,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
