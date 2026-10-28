import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
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

  it('goes to the Feed tab (First landing) after 1200 ms, having refreshed the profile', async () => {
    await render(<Loading />);
    await tick(1199);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/feed');
  });

  it('starts the profile load at once and waits only for the slower of the two', async () => {
    let finish: (value: null) => void = () => {};
    mockRefresh.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await render(<Loading />);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    await tick(1200);
    // The minimum has passed but the profile has not arrived yet.
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => finish(null));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/feed');
  });

  it('adds no wait after the minimum when the profile is already there', async () => {
    await render(<Loading />);
    await tick(1199);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await tick(1);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('shows the five dots under the progress line, the first in ember glow', async () => {
    await render(<Loading />);
    const dots = screen.getAllByTestId(/^loading-dot-/, { hidden: true });
    expect(dots).toHaveLength(5);
    const style = (i: number) => StyleSheet.flatten(dots[i]?.props.style);
    expect(style(0)).toMatchObject({ width: 10, height: 10, backgroundColor: colors.emberGlow });
    for (const i of [1, 2, 3, 4]) {
      expect(style(i)).toMatchObject({ width: 10, height: 10, backgroundColor: colors.lineStrong });
    }
  });

  it('still goes to the Feed tab when the refresh fails', async () => {
    mockRefresh.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Loading />);
    await tick(1200);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/feed');
  });

  it('does nothing after it is closed', async () => {
    const { unmount } = await render(<Loading />);
    await unmount();
    await tick(2000);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
