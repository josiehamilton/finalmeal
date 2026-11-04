import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getUnreadCount, subscribeToMyNotifications } from '@finalmeal/api';
import { FeedHeader } from './FeedHeader';

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getUnreadCount: jest.fn(),
  subscribeToMyNotifications: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: jest.requireActual('../test-support/profile').makeProfile({ id: 'u1' }),
    loading: false,
    error: null,
  }),
}));
const mockUnread = jest.mocked(getUnreadCount);
const mockSubscribe = jest.mocked(subscribeToMyNotifications);

describe('FeedHeader', () => {
  const unsubscribe = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnread.mockResolvedValue(0);
    mockSubscribe.mockReturnValue(unsubscribe);
  });

  async function show() {
    const view = await render(<FeedHeader />);
    await act(async () => {});
    return view;
  }

  it('shows the wordmark, Search and Notifications', async () => {
    await show();
    expect(screen.getByText('Final Meal')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Search' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeOnTheScreen();
  });

  it('opens Find people from Search', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/people');
  });

  it('opens Activity from the bell', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Notifications' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/notifications');
  });

  it('shows the dot at one unread and hides it at none', async () => {
    mockUnread.mockResolvedValue(1);
    await show();
    expect(screen.getByTestId('unread-dot')).toBeOnTheScreen();
  });

  it('has no dot at zero', async () => {
    await show();
    expect(screen.queryByTestId('unread-dot')).toBeNull();
  });

  it('has no dot when the count cannot load', async () => {
    mockUnread.mockRejectedValue(new TypeError('Network request failed'));
    await show();
    expect(screen.queryByTestId('unread-dot')).toBeNull();
  });

  it('reloads the count when a notification arrives, and stops listening on unmount', async () => {
    const view = await show();
    expect(mockSubscribe).toHaveBeenCalledWith({ fake: 'client' }, 'u1', expect.any(Function));
    mockUnread.mockResolvedValue(2);
    await act(async () => mockSubscribe.mock.calls[0]![2]());
    expect(screen.getByTestId('unread-dot')).toBeOnTheScreen();
    expect(unsubscribe).not.toHaveBeenCalled();
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest answer when an older one arrives late', async () => {
    let slow: (n: number) => void = () => {};
    mockUnread.mockReturnValueOnce(new Promise<number>((resolve) => (slow = resolve)));
    await render(<FeedHeader />);
    mockUnread.mockResolvedValue(0);
    await act(async () => mockSubscribe.mock.calls[0]![2]());
    await act(async () => slow(3));
    expect(screen.queryByTestId('unread-dot')).toBeNull();
  });
});
