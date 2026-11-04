import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getMyPicks, getNearbyFeed, getPlacePickers } from '@finalmeal/api';
import { FirstLanding } from './FirstLanding';
import { makeFeedItem } from '../test-support/feed';
import { makeFinals, makePick } from '../test-support/picks';
import { makeProfile } from '../test-support/profile';
import { announcePicksChanged, resetPickChanges } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/feed',
  useFocusEffect: (cb: () => void) =>
    jest.requireActual<typeof import('react')>('react').useEffect(cb, [cb]),
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyPicks: jest.fn(),
  getPlacePickers: jest.fn(),
  getNearbyFeed: jest.fn(),
  getUnreadCount: jest.fn().mockResolvedValue(0),
  subscribeToMyNotifications: jest.fn(() => () => {}),
  saveDish: jest.fn(),
  unsaveDish: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));
const mockGetPicks = jest.mocked(getMyPicks);
const mockPickers = jest.mocked(getPlacePickers);
const mockNearby = jest.mocked(getNearbyFeed);

async function show() {
  await render(<FirstLanding />);
  await act(async () => {});
}

describe('First landing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    mockProfile = makeProfile({ displayName: 'Josie Hamilton' });
    mockGetPicks.mockResolvedValue([]);
    mockPickers.mockResolvedValue({ otherCount: 0, people: [] });
    mockNearby.mockResolvedValue({ items: [], nextOffset: null });
  });

  it('greets the person by first name under the wordmark', async () => {
    await show();
    expect(screen.getByText('Final Meal')).toBeOnTheScreen();
    expect(screen.getByText('Welcome, Josie')).toBeOnTheScreen();
  });

  it('has the Feed header’s Search (Find people) and Notifications, as the board does', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Search' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/people');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeOnTheScreen();
  });

  describe('with no picks', () => {
    it('says the table is set, shows five open seats and offers the first dish', async () => {
      await show();
      expect(screen.getByText('Your table is set.')).toBeOnTheScreen();
      expect(screen.queryByText('Your Final Meal has begun.')).toBeNull();
      expect(screen.getByText('5 seats left')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Add your first dish' })).toBeOnTheScreen();
      expect(screen.queryByText(/Final Meal · #1/)).toBeNull();
    });

    it('opens Add a dish with Final Meal chosen', async () => {
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Add your first dish' }));
      expect(mockRouter.navigate).toHaveBeenCalledWith({
        pathname: '/add',
        params: { tier: 'final', from: '/feed' },
      });
    });
  });

  describe('with one pick', () => {
    beforeEach(() => {
      mockGetPicks.mockResolvedValue([
        makePick({
          dish: { id: 'd1', name: 'Pork Gyro' },
          note: 'Delicious. I’d fly back for it.',
          place: { ...makePick().place, name: 'Skewers', city: 'Vancouver' },
        }),
      ]);
    });

    it('shows the hero card for slot 1', async () => {
      await show();
      expect(screen.getByText('Your Final Meal has begun.')).toBeOnTheScreen();
      expect(screen.getByText('Final Meal · #1')).toBeOnTheScreen();
      expect(screen.getByText('Pork Gyro')).toBeOnTheScreen();
      expect(screen.getByText('Skewers · Vancouver')).toBeOnTheScreen();
      expect(screen.getByText('“Delicious. I’d fly back for it.”')).toBeOnTheScreen();
    });

    it('says 4 seats left and offers the next dish', async () => {
      await show();
      expect(screen.getByText('4 seats left')).toBeOnTheScreen();
      expect(screen.getByLabelText('1 of 5 chosen')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Add your next dish' }));
      expect(mockRouter.navigate).toHaveBeenCalledWith({
        pathname: '/add',
        params: { tier: 'final', from: '/feed' },
      });
    });

    it('leaves the note out when there is none', async () => {
      mockGetPicks.mockResolvedValue([makePick({ note: null })]);
      await show();
      expect(screen.queryByText(/“/)).toBeNull();
    });

    it('opens the pick from the hero card', async () => {
      await show();
      await fireEvent.press(screen.getByRole('button', { name: /Open Pork Gyro/ }));
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk1');
    });

    it('says nothing about neighbours or Nearby when there are none', async () => {
      await show();
      expect(screen.queryByText(/others? in/)).toBeNull();
      expect(screen.queryByText(/Nearby in/)).toBeNull();
      expect(screen.queryByText('See the map')).toBeNull();
    });

    describe('others at the hero’s place', () => {
      const person = (n: number) => ({
        id: `x${n}`,
        username: `person${n}`,
        displayName: `Person ${n}`,
        avatarUrl: null,
      });

      it('asks about the hero’s place and says how many others have it on their list', async () => {
        mockPickers.mockResolvedValue({ otherCount: 8, people: [person(1), person(2), person(3)] });
        await show();
        expect(mockPickers).toHaveBeenCalledWith({ fake: 'client' }, 'p1');
        expect(
          screen.getByText('8 others in Vancouver have Skewers on their list'),
        ).toBeOnTheScreen();
      });

      it('shows at most three avatars', async () => {
        mockPickers.mockResolvedValue({
          otherCount: 8,
          people: [person(1), person(2), person(3), person(4)],
        });
        await show();
        expect(screen.getAllByTestId('landing-picker')).toHaveLength(3);
      });

      it('is singular for one', async () => {
        mockPickers.mockResolvedValue({ otherCount: 1, people: [person(1)] });
        await show();
        expect(screen.getByText('1 other in Vancouver has Skewers on their list')).toBeOnTheScreen();
      });

      it('is hidden at zero', async () => {
        await show();
        expect(screen.queryByText(/others? in/)).toBeNull();
      });

      it('is hidden when it cannot load, leaving the hero card', async () => {
        mockPickers.mockRejectedValue(new TypeError('Network request failed'));
        await show();
        expect(screen.queryByText(/others? in/)).toBeNull();
        expect(screen.getByText('Pork Gyro')).toBeOnTheScreen();
      });
    });

    describe('Nearby section', () => {
      const nearby = (n: number) =>
        Array.from({ length: n }, (_, i) =>
          makeFeedItem({
            key: `n${i + 1}`,
            actor: { id: `x${i}`, username: `near${i + 1}`, displayName: `Near ${i + 1}`, avatarUrl: null },
            pick: makePick({ id: `np${i + 1}`, dish: { id: `nd${i + 1}`, name: `Nearby dish ${i + 1}` } }),
          }),
        );

      it('shows the first three Nearby cards under the home city’s name', async () => {
        mockNearby.mockResolvedValue({ items: nearby(3), nextOffset: 3 });
        await show();
        expect(mockNearby).toHaveBeenCalledWith({ fake: 'client' }, 0, 3);
        expect(screen.getByText('Nearby in Vancouver')).toBeOnTheScreen();
        expect(screen.getByText('@near1')).toBeOnTheScreen();
        expect(screen.getByText('Nearby dish 3')).toBeOnTheScreen();
        expect(screen.queryByText('See the map')).toBeNull();
      });

      it('shows no more than three, even if more come back', async () => {
        mockNearby.mockResolvedValue({ items: nearby(5), nextOffset: 5 });
        await show();
        expect(screen.getByText('Nearby dish 3')).toBeOnTheScreen();
        expect(screen.queryByText('Nearby dish 4')).toBeNull();
      });

      it('is hidden when nobody is nearby', async () => {
        await show();
        expect(screen.queryByText(/Nearby in/)).toBeNull();
      });

      it('is hidden, and never asked for, without a home city', async () => {
        mockProfile = makeProfile({ displayName: 'Josie Hamilton', homeCity: null });
        mockNearby.mockResolvedValue({ items: nearby(3), nextOffset: 3 });
        await show();
        expect(mockNearby).not.toHaveBeenCalled();
        expect(screen.queryByText(/Nearby in/)).toBeNull();
      });

      it('is hidden when it cannot load, leaving the rest of the page', async () => {
        mockNearby.mockRejectedValue(new TypeError('Network request failed'));
        await show();
        expect(screen.queryByText(/Nearby in/)).toBeNull();
        expect(screen.getByText('Pork Gyro')).toBeOnTheScreen();
      });
    });
  });

  describe('with four picks', () => {
    it('says 1 seat left (singular), with slot 1 as the hero', async () => {
      mockGetPicks.mockResolvedValue(makeFinals(4));
      await show();
      expect(screen.getByText('1 seat left')).toBeOnTheScreen();
      expect(screen.queryByText('1 seats left')).toBeNull();
      expect(screen.getByLabelText('4 of 5 chosen')).toBeOnTheScreen();
      expect(screen.getByText('Dish 1')).toBeOnTheScreen();
      expect(screen.getByText('Final Meal · #1')).toBeOnTheScreen();
    });
  });

  it('counts only Final Meal picks, and takes slot 1 as the hero whatever the order', async () => {
    mockGetPicks.mockResolvedValue([
      makePick({ id: 'h1', tier: 'honorable', slot: null, dish: { id: 'x', name: 'Honorable Soup' } }),
      ...makeFinals(3).reverse(),
    ]);
    await show();
    expect(screen.getByText('2 seats left')).toBeOnTheScreen();
    expect(screen.getByText('Dish 1')).toBeOnTheScreen();
    expect(screen.queryByText('Honorable Soup')).toBeNull();
  });

  describe('with five picks', () => {
    beforeEach(() => {
      mockGetPicks.mockResolvedValue(makeFinals(5));
    });

    it('says all five seats are taken and offers an Honorable Mention', async () => {
      await show();
      expect(screen.getByText('All five seats taken')).toBeOnTheScreen();
      expect(screen.queryByText('0 seats left')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add your next dish' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Add an Honorable Mention' })).toBeOnTheScreen();
    });

    it('opens Add with Honorable Mention chosen', async () => {
      await show();
      await fireEvent.press(screen.getByRole('button', { name: 'Add an Honorable Mention' }));
      expect(mockRouter.navigate).toHaveBeenCalledWith({
        pathname: '/add',
        params: { tier: 'honorable', from: '/feed' },
      });
    });
  });

  describe('when a pick was saved without its photo', () => {
    const notice = 'Saved without the photo. Add it from the dish any time.';

    it('shows the notice, which can be dismissed', async () => {
      mockGetPicks.mockResolvedValue(makeFinals(1));
      await show();
      expect(screen.queryByText(notice)).toBeNull();
      await act(async () => announcePicksChanged({ photoFailed: true }));
      expect(screen.getByText(notice)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText(notice)).toBeNull();
    });

    it('shows a notice raised before the landing mounted', async () => {
      await act(async () => announcePicksChanged({ photoFailed: true }));
      mockGetPicks.mockResolvedValue(makeFinals(1));
      await show();
      expect(screen.getByText(notice)).toBeOnTheScreen();
    });
  });

  it('shows a spinner while loading, then the content', async () => {
    let resolve: (v: never[]) => void = () => {};
    mockGetPicks.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<FirstLanding />);
    expect(screen.getByTestId('landing-loading')).toBeOnTheScreen();
    await act(async () => resolve([]));
    expect(screen.queryByTestId('landing-loading')).toBeNull();
    expect(screen.getByText('Your table is set.')).toBeOnTheScreen();
  });

  it('shows the friendly error with Try again when the picks cannot load', async () => {
    mockGetPicks.mockRejectedValueOnce(new TypeError('Network request failed'));
    await show();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await act(async () => {});
    expect(screen.getByText('Your table is set.')).toBeOnTheScreen();
  });

  it('refreshes when the picks change elsewhere', async () => {
    await show();
    expect(screen.getByText('Your table is set.')).toBeOnTheScreen();
    mockGetPicks.mockResolvedValue(makeFinals(1));
    await act(async () => announcePicksChanged());
    expect(screen.getByText('Your Final Meal has begun.')).toBeOnTheScreen();
    expect(screen.getByText('4 seats left')).toBeOnTheScreen();
  });
});
