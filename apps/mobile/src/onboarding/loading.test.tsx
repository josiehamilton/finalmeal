import { act, render, screen } from '@testing-library/react-native';
import Loading from '../../app/(onboarding)/loading';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockRefresh = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, []),
}));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ refreshProfile: mockRefresh }),
}));

async function tick(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('Loading screen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockRefresh.mockResolvedValue(null);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the line and status', async () => {
    await render(<Loading />);
    expect(screen.getByText('There can only be five.')).toBeOnTheScreen();
    expect(screen.getByText('Setting your table…')).toBeOnTheScreen();
  });

  it('goes to You after 1200 ms, having refreshed the profile', async () => {
    await render(<Loading />);
    await tick(1199);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/you');
  });

  it('still goes to You when the refresh fails', async () => {
    mockRefresh.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Loading />);
    await tick(1200);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/you');
  });

  it('does nothing after it is closed', async () => {
    const { unmount } = await render(<Loading />);
    await unmount();
    await tick(2000);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
