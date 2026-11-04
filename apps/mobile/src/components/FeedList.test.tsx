import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getFollowingFeed, getNearbyFeed, getSuggestedPeople } from '@finalmeal/api';
import { FeedList } from './FeedList';
import { makeFeedItem, makeFeedItems } from '../test-support/feed';
import { makeProfile } from '../test-support/profile';
import { announcePicksChanged, resetPickChanges } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
const mockFocus: { current: () => void } = { current: () => {} };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (cb: () => void) => {
    mockFocus.current = cb;
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]);
  },
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getFollowingFeed: jest.fn(),
  getNearbyFeed: jest.fn(),
  getSuggestedPeople: jest.fn(),
  saveDish: jest.fn(),
  unsaveDish: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockProfile = makeProfile();
const mockRefreshProfile = jest.fn();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: false,
    error: null,
    refreshProfile: mockRefreshProfile,
  }),
}));
const mockFollowing = jest.mocked(getFollowingFeed);
const mockNearby = jest.mocked(getNearbyFeed);
const mockSuggested = jest.mocked(getSuggestedPeople);
const client = { fake: 'client' };

async function show(mode: 'following' | 'nearby') {
  await render(<FeedList mode={mode} />);
  await act(async () => {});
}

const endReached = () => fireEvent(screen.getByTestId('feed-list'), 'endReached');

describe('FeedList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    mockProfile = makeProfile({ counts: { followers: 0, following: 3, dishes: 0 } });
    mockRefreshProfile.mockResolvedValue(null);
    mockSuggested.mockResolvedValue([]);
    mockFollowing.mockResolvedValue({ items: [], next: null });
    mockNearby.mockResolvedValue({ items: [], nextOffset: null });
  });

  describe('Following', () => {
    it('loads the first page, 20 at a time, and shows the cards', async () => {
      mockFollowing.mockResolvedValue({
        items: [
          makeFeedItem(),
          makeFeedItem({
            key: 'act-2',
            actor: {
              id: 'u2',
              username: 'mikebrennan',
              displayName: 'Mike Brennan',
              avatarUrl: null,
            },
          }),
        ],
        next: null,
      });
      await show('following');
      expect(mockFollowing).toHaveBeenCalledWith(client, undefined, 20);
      expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
      expect(screen.getByText('@mikebrennan')).toBeOnTheScreen();
      expect(mockNearby).not.toHaveBeenCalled();
    });

    it('shows a spinner until the first page arrives', async () => {
      let finish: (v: { items: never[]; next: null }) => void = () => {};
      mockFollowing.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await render(<FeedList mode="following" />);
      expect(screen.getByTestId('feed-loading')).toBeOnTheScreen();
      await act(async () => finish({ items: [], next: null }));
      expect(screen.queryByTestId('feed-loading')).toBeNull();
    });

    it('asks for the next page with the cursor exactly as it was given, and appends it', async () => {
      const next = { before: '2026-11-03T10:20:30.123456+00:00', beforeKey: 'k20' };
      mockFollowing.mockResolvedValueOnce({ items: makeFeedItems(20), next });
      mockFollowing.mockResolvedValueOnce({ items: makeFeedItems(2, 21), next: null });
      await show('following');
      expect(screen.queryByText('Dish 21')).toBeNull();
      await endReached();
      await act(async () => {});
      expect(mockFollowing).toHaveBeenCalledTimes(2);
      expect(mockFollowing.mock.calls[1]![1]).toBe(next);
      expect(mockFollowing.mock.calls[1]![2]).toBe(20);
      expect(
        screen.getByTestId('feed-list').props.data.map((i: { key: string }) => i.key),
      ).toHaveLength(22);
    });

    it('shows a footer spinner while the next page loads, and does not ask twice', async () => {
      const next = { before: '2026-11-03T10:20:30.123456+00:00', beforeKey: 'k20' };
      mockFollowing.mockResolvedValueOnce({ items: makeFeedItems(20), next });
      let finish: (v: { items: ReturnType<typeof makeFeedItems>; next: null }) => void = () => {};
      mockFollowing.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
      await show('following');
      await endReached();
      await endReached();
      expect(mockFollowing).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('feed-more')).toBeOnTheScreen();
      await act(async () => finish({ items: makeFeedItems(1, 21), next: null }));
      expect(screen.queryByTestId('feed-more')).toBeNull();
    });

    it('stops asking once there is no next page', async () => {
      mockFollowing.mockResolvedValue({ items: makeFeedItems(3), next: null });
      await show('following');
      await endReached();
      expect(mockFollowing).toHaveBeenCalledTimes(1);
    });

    it('says when the next page cannot load, and Try again continues from the same cursor', async () => {
      const next = { before: '2026-11-03T10:20:30.123456+00:00', beforeKey: 'k20' };
      mockFollowing.mockResolvedValueOnce({ items: makeFeedItems(20), next });
      mockFollowing.mockRejectedValueOnce(new TypeError('Network request failed'));
      mockFollowing.mockResolvedValueOnce({ items: makeFeedItems(1, 21), next: null });
      await show('following');
      await endReached();
      await act(async () => {});
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      expect(screen.getByTestId('feed-list').props.data).toHaveLength(20);
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      await act(async () => {});
      expect(mockFollowing.mock.calls[2]![1]).toBe(next);
      expect(screen.queryByText('Can’t reach the kitchen right now.')).toBeNull();
      expect(screen.getByTestId('feed-list').props.data).toHaveLength(21);
    });

    it('shows the friendly copy and Try again when the feed cannot load', async () => {
      mockFollowing.mockRejectedValueOnce(new TypeError('Network request failed'));
      await show('following');
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      expect(screen.queryByText('An empty table.')).toBeNull();
      mockFollowing.mockResolvedValue({ items: [makeFeedItem()], next: null });
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      await act(async () => {});
      expect(screen.queryByText('Can’t reach the kitchen right now.')).toBeNull();
      expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
    });

    it('pull to refresh loads the first page again', async () => {
      mockFollowing.mockResolvedValueOnce({ items: [makeFeedItem()], next: null });
      await show('following');
      mockFollowing.mockResolvedValueOnce({ items: makeFeedItems(2), next: null });
      await act(async () => {
        await screen.getByTestId('feed-list').props.refreshControl.props.onRefresh();
      });
      expect(mockFollowing).toHaveBeenCalledTimes(2);
      expect(mockFollowing.mock.calls[1]![1]).toBeUndefined();
      expect(screen.queryByText('Pork Gyro')).toBeNull();
      expect(screen.getByText('Dish 1')).toBeOnTheScreen();
    });

    it('keeps the cards on screen with the reason when a refresh fails', async () => {
      mockFollowing.mockResolvedValueOnce({ items: [makeFeedItem()], next: null });
      await show('following');
      mockFollowing.mockRejectedValueOnce(new TypeError('Network request failed'));
      await act(async () => {
        await screen.getByTestId('feed-list').props.refreshControl.props.onRefresh();
      });
      expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    });

    it('ignores a slow older answer once a newer load has been asked for', async () => {
      let slow: (v: { items: ReturnType<typeof makeFeedItems>; next: null }) => void = () => {};
      mockFollowing.mockReturnValueOnce(new Promise((resolve) => (slow = resolve)));
      await render(<FeedList mode="following" />);
      mockFollowing.mockResolvedValueOnce({ items: [makeFeedItem()], next: null });
      await act(async () => {
        await screen.getByTestId('feed-list').props.refreshControl.props.onRefresh();
      });
      await act(async () => slow({ items: makeFeedItems(2), next: null }));
      expect(screen.getByText('Pork Gyro')).toBeOnTheScreen();
      expect(screen.queryByText('Dish 1')).toBeNull();
    });

    it('shows the saved-without-photo notice at the top', async () => {
      await act(async () => announcePicksChanged({ photoFailed: true }));
      mockFollowing.mockResolvedValue({ items: [makeFeedItem()], next: null });
      await show('following');
      expect(
        screen.getByText('Saved without the photo. Add it from the dish any time.'),
      ).toBeOnTheScreen();
    });

    it('says it is an empty table to someone following nobody', async () => {
      mockProfile = makeProfile({ counts: { followers: 0, following: 0, dishes: 0 } });
      await show('following');
      expect(screen.getByText('An empty table.')).toBeOnTheScreen();
    });

    it('says nothing is new to someone who follows people', async () => {
      await show('following');
      expect(screen.getByText('Nothing new yet.')).toBeOnTheScreen();
      expect(screen.queryByText('An empty table.')).toBeNull();
    });

    it('refreshes the profile when the feed is empty, so the follow count is current', async () => {
      await show('following');
      expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
    });

    it('does not touch the profile when there is something to show', async () => {
      mockFollowing.mockResolvedValue({ items: [makeFeedItem()], next: null });
      await show('following');
      expect(mockRefreshProfile).not.toHaveBeenCalled();
    });

    it('looks again when the screen regains focus while empty, but not when it has cards', async () => {
      await show('following');
      expect(mockFollowing).toHaveBeenCalledTimes(1);
      mockFollowing.mockResolvedValue({ items: [makeFeedItem()], next: null });
      await act(async () => mockFocus.current());
      expect(mockFollowing).toHaveBeenCalledTimes(2);
      expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
      await act(async () => mockFocus.current());
      expect(mockFollowing).toHaveBeenCalledTimes(2);
    });

    it('tolerates a profile refresh that fails', async () => {
      mockRefreshProfile.mockRejectedValue(new Error('offline'));
      await show('following');
      expect(screen.getByText('Nothing new yet.')).toBeOnTheScreen();
    });
  });

  describe('Nearby', () => {
    it('loads the first page from offset 0, 20 at a time', async () => {
      mockNearby.mockResolvedValue({ items: [makeFeedItem()], nextOffset: null });
      await show('nearby');
      expect(mockNearby).toHaveBeenCalledWith(client, 0, 20);
      expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
      expect(mockFollowing).not.toHaveBeenCalled();
    });

    it('continues from nextOffset and drops repeats by key', async () => {
      mockNearby.mockResolvedValueOnce({ items: makeFeedItems(20), nextOffset: 20 });
      // The ranking moved: the second page repeats k19 and k20 and adds two new ones.
      mockNearby.mockResolvedValueOnce({ items: makeFeedItems(4, 19), nextOffset: null });
      await show('nearby');
      await endReached();
      await act(async () => {});
      expect(mockNearby).toHaveBeenNthCalledWith(2, client, 20, 20);
      const keys = screen.getByTestId('feed-list').props.data.map((i: { key: string }) => i.key);
      expect(keys).toHaveLength(22);
      expect(new Set(keys).size).toBe(22);
    });

    it('asks for a home city when there is none, without loading anything', async () => {
      mockProfile = makeProfile({ homeCity: null });
      await show('nearby');
      expect(screen.getByText('Set your home city to see picks near you.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Choose home city' })).toBeOnTheScreen();
      expect(mockNearby).not.toHaveBeenCalled();
      expect(mockFollowing).not.toHaveBeenCalled();
      await endReached();
      expect(mockNearby).not.toHaveBeenCalled();
    });

    it('says nothing is nearby yet, naming the city', async () => {
      await show('nearby');
      expect(screen.getByText('Nothing nearby yet.')).toBeOnTheScreen();
      expect(
        screen.getByText('When people near Vancouver add dishes, they show up here.'),
      ).toBeOnTheScreen();
    });

    it('shows Try again when it cannot load', async () => {
      mockNearby.mockRejectedValueOnce(new TypeError('Network request failed'));
      await show('nearby');
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      mockNearby.mockResolvedValue({ items: [makeFeedItem()], nextOffset: null });
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      await act(async () => {});
      expect(screen.getByText('@arimitchell')).toBeOnTheScreen();
    });
  });
});
