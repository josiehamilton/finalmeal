import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getMyPicks } from '@finalmeal/api';
import { FirstLanding } from './FirstLanding';
import { makeFinals, makePick } from '../test-support/picks';
import { makeProfile } from '../test-support/profile';
import { announcePicksChanged, resetPickChanges } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyPicks: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
let mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));
const mockGetPicks = jest.mocked(getMyPicks);

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
  });

  it('greets the person by first name under the wordmark', async () => {
    await show();
    expect(screen.getByText('Final Meal')).toBeOnTheScreen();
    expect(screen.getByText('Welcome, Josie')).toBeOnTheScreen();
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
        params: { tier: 'final' },
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
        params: { tier: 'final' },
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

    it('keeps the Phase 4 pieces out: no neighbours line, no Nearby section', async () => {
      await show();
      expect(screen.queryByText(/others in/)).toBeNull();
      expect(screen.queryByText(/Nearby in/)).toBeNull();
      expect(screen.queryByText('See the map')).toBeNull();
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

  it('says 0 seats left with five picks', async () => {
    mockGetPicks.mockResolvedValue(makeFinals(5));
    await show();
    expect(screen.getByText('0 seats left')).toBeOnTheScreen();
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
