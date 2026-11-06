import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  getMyNotifications,
  markNotificationsRead,
  respondToFollowRequest,
  subscribeToMyNotifications,
} from '@finalmeal/api';
import Activity from '../../app/(app)/notifications';
import { resetFollowStore } from '../state/follow-store';
import { makeActivity, makeFollowed, makeRequest, makeSaved } from '../test-support/activity';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyNotifications: jest.fn(),
  markNotificationsRead: jest.fn(),
  respondToFollowRequest: jest.fn(),
  subscribeToMyNotifications: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: false,
    error: null,
    refreshProfile: jest.fn(),
  }),
}));
let mockProfile = makeProfile();
const mockGet = jest.mocked(getMyNotifications);
const mockRead = jest.mocked(markNotificationsRead);
const mockRespond = jest.mocked(respondToFollowRequest);
const mockSubscribe = jest.mocked(subscribeToMyNotifications);
const client = { fake: 'client' };

const DAY = 24 * 3_600_000;
/** Two days back is never "today", whatever the time of day. */
const longAgo = () => new Date(Date.now() - 2 * DAY).toISOString();

async function show() {
  await render(<Activity />);
  await act(async () => {});
}

/** The ids of every row the list holds (the list itself only renders those near the screen). */
function heldIds(): string[] {
  const list = screen.getByTestId('activity-list');
  return (list.props.data as { data: { id: string }[] }[]).flatMap((s) => s.data.map((n) => n.id));
}

function many(n: number, from = 1) {
  return Array.from({ length: n }, (_, i) =>
    makeSaved({
      id: `m${from + i}`,
      readAt: null,
      at: new Date(Date.now() - (from + i) * 1000).toISOString(),
    }),
  );
}

describe('Activity', () => {
  let arrive: () => void = () => {};
  const unsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetFollowStore();
    mockProfile = makeProfile();
    mockGet.mockResolvedValue([]);
    mockRead.mockResolvedValue(undefined);
    mockRespond.mockResolvedValue(undefined);
    mockSubscribe.mockImplementation((_client, _id, onChange) => {
      arrive = onChange;
      return unsubscribe;
    });
  });

  it('shows the board: Today with three rows, then Earlier', async () => {
    mockGet.mockResolvedValue([
      makeActivity(),
      makeFollowed(),
      makeSaved(),
      makeSaved({ id: 'old', at: longAgo(), dishName: 'Ramen' }),
    ]);
    await show();
    expect(mockGet).toHaveBeenCalledWith(client, { limit: 20 });
    expect(screen.getByText('Activity')).toBeOnTheScreen();
    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Earlier')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ari Mitchell dethroned Tacos Al Pastor with Smash Burger on their Final Meal.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('2m')).toBeOnTheScreen();
    expect(screen.getByText('Alli Mercer started following you.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Follow back' })).toBeOnTheScreen();
    expect(screen.getByText('Mike Brennan saved your Pork Gyro.')).toBeOnTheScreen();
    expect(screen.getByText('Mike Brennan saved your Ramen.')).toBeOnTheScreen();
    expect(screen.getByText('2d')).toBeOnTheScreen();
    // Ari and Alli are unread; the two saves are read.
    expect(screen.getAllByLabelText('Unread')).toHaveLength(2);
  });

  it('groups by calendar day: only Earlier when nothing is from today', async () => {
    mockGet.mockResolvedValue([makeSaved({ at: longAgo() })]);
    await show();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.getByText('Earlier')).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    await show();
    expect(screen.getByText('No activity yet.')).toBeOnTheScreen();
    expect(
      screen.getByText('When people follow you or save your picks, it shows up here.'),
    ).toBeOnTheScreen();
  });

  it('shows a spinner first, then a problem with Try again', async () => {
    let fail: (e: Error) => void = () => {};
    mockGet.mockReturnValueOnce(new Promise((_resolve, reject) => (fail = reject)));
    await render(<Activity />);
    expect(screen.getByTestId('activity-loading')).toBeOnTheScreen();
    await act(async () => fail(new Error('offline')));
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    mockGet.mockResolvedValue([makeFollowed()]);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {});
    expect(screen.getByText('Alli Mercer started following you.')).toBeOnTheScreen();
  });

  describe('Mark all read', () => {
    it('clears every dot and is then disabled', async () => {
      mockGet.mockResolvedValue([makeActivity(), makeFollowed(), makeSaved()]);
      await show();
      const markAll = screen.getByRole('button', { name: 'Mark all read' });
      expect(markAll).toBeEnabled();
      await fireEvent.press(markAll);
      expect(mockRead).toHaveBeenCalledWith(client);
      expect(screen.queryAllByLabelText('Unread')).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
    });

    it('is disabled when nothing is unread', async () => {
      mockGet.mockResolvedValue([makeSaved()]);
      await show();
      expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Mark all read' }));
      expect(mockRead).not.toHaveBeenCalled();
    });

    it('brings the dots back with friendly copy when it fails', async () => {
      mockGet.mockResolvedValue([makeActivity(), makeFollowed()]);
      mockRead.mockRejectedValue(new Error('offline'));
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Mark all read' }));
      await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen());
      expect(screen.getAllByLabelText('Unread')).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Mark all read' })).toBeEnabled();
    });
  });

  describe('tapping a row', () => {
    it('marks just that one read and opens the pick for a pick activity', async () => {
      mockGet.mockResolvedValue([makeActivity(), makeFollowed()]);
      await show();
      await fireEvent.press(screen.getByText('2m'));
      expect(mockRead).toHaveBeenCalledWith(client, ['n1']);
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-ari');
      expect(screen.getAllByLabelText('Unread')).toHaveLength(1);
    });

    it('opens the actor for a follow', async () => {
      mockGet.mockResolvedValue([makeFollowed()]);
      await show();
      await fireEvent.press(screen.getByText('14m'));
      expect(mockRead).toHaveBeenCalledWith(client, ['n2']);
      expect(mockRouter.push).toHaveBeenCalledWith('/u/u4');
    });

    it('opens the actor for a request and an approval', async () => {
      mockGet.mockResolvedValue([
        makeRequest({ requestPending: false }),
        makeFollowed({ id: 'n9', type: 'follow_accepted', actor: makeSaved().actor }),
      ]);
      await show();
      const times = screen.getAllByText('14m');
      await fireEvent.press(times[0]!);
      expect(mockRouter.push).toHaveBeenLastCalledWith('/u/u4');
      await fireEvent.press(times[1]!);
      expect(mockRouter.push).toHaveBeenLastCalledWith('/u/u5');
    });

    it('marks a list save read but opens nothing (lists are Phase 6)', async () => {
      mockGet.mockResolvedValue([
        makeActivity({
          type: 'saved_from_list',
          pickId: null,
          dishName: null,
          otherDishName: null,
          listTitle: 'Date night',
        }),
      ]);
      await show();
      await fireEvent.press(screen.getByText('2m'));
      expect(mockRead).toHaveBeenCalledWith(client, ['n1']);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('does not mark an already-read row again, but still opens it', async () => {
      mockGet.mockResolvedValue([makeSaved()]);
      await show();
      await fireEvent.press(screen.getByText('1h'));
      expect(mockRead).not.toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-gyro');
    });

    it('still opens when marking read fails', async () => {
      mockRead.mockRejectedValue(new Error('offline'));
      mockGet.mockResolvedValue([makeActivity()]);
      await show();
      await fireEvent.press(screen.getByText('2m'));
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-ari');
    });
  });

  describe('follow requests', () => {
    it('Approve answers the request, then the row reads as a follow with Follow back', async () => {
      mockGet.mockResolvedValue([makeRequest()]);
      await show();
      expect(screen.getByText('Alli Mercer wants to follow you.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Approve Alli Mercer' }));
      expect(mockRespond).toHaveBeenCalledWith(client, 'u4', true);
      expect(await screen.findByText('Alli Mercer started following you.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Follow back' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /Approve|Decline/ })).toBeNull();
    });

    it('Decline answers the request and removes the row', async () => {
      mockGet.mockResolvedValue([makeRequest(), makeSaved()]);
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Decline Alli Mercer' }));
      expect(mockRespond).toHaveBeenCalledWith(client, 'u4', false);
      await waitFor(() =>
        expect(screen.queryByText('Alli Mercer wants to follow you.')).toBeNull(),
      );
      expect(screen.getByText('Mike Brennan saved your Pork Gyro.')).toBeOnTheScreen();
    });

    it('a failure keeps the row, with friendly copy, and can be tried again', async () => {
      mockGet.mockResolvedValue([makeRequest()]);
      mockRespond.mockRejectedValueOnce(new Error('offline'));
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Approve Alli Mercer' }));
      expect(await screen.findByRole('alert')).toBeOnTheScreen();
      expect(screen.getByText('Alli Mercer wants to follow you.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Approve Alli Mercer' }));
      expect(await screen.findByText('Alli Mercer started following you.')).toBeOnTheScreen();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('ignores a second tap while an answer is in flight', async () => {
      let finish: () => void = () => {};
      mockRespond.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      mockGet.mockResolvedValue([makeRequest()]);
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Approve Alli Mercer' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Decline Alli Mercer' }));
      expect(mockRespond).toHaveBeenCalledTimes(1);
      await act(async () => finish());
    });
  });

  describe('following back', () => {
    it('shares the follow state with the store: a row seeded Following shows Following', async () => {
      mockGet.mockResolvedValue([makeFollowed({ viewerFollow: 'active' })]);
      await show();
      expect(screen.getByRole('button', { name: 'Following' })).toBeOnTheScreen();
    });
  });

  describe('paging', () => {
    it('loads 20 at a time, passing the last time back as it came', async () => {
      const first = many(20);
      mockGet.mockResolvedValueOnce(first).mockResolvedValueOnce(many(3, 21));
      await show();
      await fireEvent(screen.getByTestId('activity-list'), 'endReached');
      await act(async () => {});
      expect(mockGet).toHaveBeenLastCalledWith(client, {
        before: first[19]!.at,
        limit: 20,
      });
      expect(heldIds()).toHaveLength(23);
      // The last page was short: nothing more to ask for.
      await fireEvent(screen.getByTestId('activity-list'), 'endReached');
      await act(async () => {});
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('does not ask for a next page after a short first page', async () => {
      mockGet.mockResolvedValue(many(5));
      await show();
      await fireEvent(screen.getByTestId('activity-list'), 'endReached');
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('skips a repeated notification', async () => {
      const first = many(20);
      mockGet.mockResolvedValueOnce(first).mockResolvedValueOnce([first[19]!, ...many(2, 21)]);
      await show();
      await fireEvent(screen.getByTestId('activity-list'), 'endReached');
      await act(async () => {});
      expect(heldIds()).toEqual([...first.map((n) => n.id), 'm21', 'm22']);
    });

    it('a failed next page shows Try again once, and scrolling does not loop', async () => {
      const first = many(20);
      mockGet.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('offline'));
      await show();
      await fireEvent(screen.getByTestId('activity-list'), 'endReached');
      await act(async () => {});
      expect(screen.getByRole('alert')).toBeOnTheScreen();
      await fireEvent(screen.getByTestId('activity-list'), 'endReached');
      await act(async () => {});
      expect(mockGet).toHaveBeenCalledTimes(2);
      mockGet.mockResolvedValueOnce(many(1, 21));
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      await act(async () => {});
      expect(mockGet).toHaveBeenCalledTimes(3);
      expect(mockGet).toHaveBeenLastCalledWith(client, { before: first[19]!.at, limit: 20 });
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('live updates', () => {
    it('listens for your own notifications, and stops on unmount', async () => {
      const view = await render(<Activity />);
      await act(async () => {});
      expect(mockSubscribe).toHaveBeenCalledWith(client, 'u1', expect.any(Function));
      await view.unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('puts a new arrival on top without losing what was read', async () => {
      mockGet.mockResolvedValue([makeSaved()]);
      await show();
      mockGet.mockResolvedValue([makeActivity(), makeSaved()]);
      await act(async () => arrive());
      expect(
        await screen.findByText(
          'Ari Mitchell dethroned Tacos Al Pastor with Smash Burger on their Final Meal.',
        ),
      ).toBeOnTheScreen();
      expect(screen.getAllByText('Mike Brennan saved your Pork Gyro.')).toHaveLength(1);
      expect(screen.getAllByLabelText('Unread')).toHaveLength(1);
    });
  });

  it('goes back', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
