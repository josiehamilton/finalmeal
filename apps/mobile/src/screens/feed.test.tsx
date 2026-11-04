import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getFollowingFeed, getNearbyFeed, getUnreadCount, getMyPicks } from '@finalmeal/api';
import Feed from '../../app/(app)/(tabs)/feed';
import { makeFeedItem } from '../test-support/feed';
import { makeProfile } from '../test-support/profile';
import { clearJustOnboarded, markJustOnboarded } from '../state/landing';

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/feed',
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getFollowingFeed: jest.fn(),
  getNearbyFeed: jest.fn(),
  getUnreadCount: jest.fn(),
  subscribeToMyNotifications: jest.fn(() => () => {}),
  getMyPicks: jest.fn(),
  getPlacePickers: jest.fn(),
  getSuggestedPeople: jest.fn().mockResolvedValue([]),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: false,
    error: null,
    refreshProfile: jest.fn().mockResolvedValue(null),
  }),
}));
const mockFollowing = jest.mocked(getFollowingFeed);
const mockNearby = jest.mocked(getNearbyFeed);

async function show() {
  await render(<Feed />);
  await act(async () => {});
}

describe('Feed tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearJustOnboarded();
    mockProfile = makeProfile();
    jest.mocked(getUnreadCount).mockResolvedValue(0);
    jest.mocked(getMyPicks).mockResolvedValue([]);
    mockFollowing.mockResolvedValue({ items: [makeFeedItem()], next: null });
    mockNearby.mockResolvedValue({
      items: [
        makeFeedItem({
          key: 'near-1',
          actor: { id: 'u9', username: 'devpatel', displayName: 'Dev Patel', avatarUrl: null },
        }),
      ],
      nextOffset: null,
    });
  });

  it('opens on Following under the header, with Following and Nearby tabs only', async () => {
    await show();
    expect(screen.getByText('Final Meal')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Following' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Nearby' })).not.toBeSelected();
    expect(screen.queryByRole('tab', { name: 'Trending' })).toBeNull();
    expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
    expect(mockNearby).not.toHaveBeenCalled();
  });

  it('switches to Nearby and back without reloading Following', async () => {
    await show();
    await fireEvent.press(screen.getByRole('tab', { name: 'Nearby' }));
    await act(async () => {});
    expect(screen.getByRole('tab', { name: 'Nearby' })).toBeSelected();
    expect(screen.getByText('@devpatel')).toBeOnTheScreen();
    expect(screen.queryByText('@arimitchell')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Following' }));
    expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
    expect(mockFollowing).toHaveBeenCalledTimes(1);
    expect(mockNearby).toHaveBeenCalledTimes(1);
  });

  it('asks for a home city on Nearby when there is none', async () => {
    mockProfile = makeProfile({ homeCity: null });
    await show();
    await fireEvent.press(screen.getByRole('tab', { name: 'Nearby' }));
    expect(screen.getByText('Set your home city to see picks near you.')).toBeOnTheScreen();
    expect(mockNearby).not.toHaveBeenCalled();
  });

  it('shows First landing instead while the person has just onboarded', async () => {
    await act(async () => markJustOnboarded());
    await show();
    expect(screen.getByText('Welcome, Josie')).toBeOnTheScreen();
    expect(screen.queryByRole('tab', { name: 'Following' })).toBeNull();
    expect(mockFollowing).not.toHaveBeenCalled();
  });

  it('swaps First landing for the feed as soon as the flag clears', async () => {
    await act(async () => markJustOnboarded());
    await show();
    await act(async () => clearJustOnboarded());
    expect(screen.getByRole('tab', { name: 'Following' })).toBeSelected();
  });
});
