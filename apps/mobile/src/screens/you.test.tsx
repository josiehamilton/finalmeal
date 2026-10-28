import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { getMyPicks } from '@finalmeal/api';
import You from '../../app/(app)/(tabs)/you';
import { makeProfile } from '../test-support/profile';
import { seedPicks } from '../test-support/seed-picks';
import { makeFinals, makePick } from '../test-support/picks';
import { announcePicksChanged, resetPickChanges } from '../state/pick-changes';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getMyPicks: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockGetPicks = jest.mocked(getMyPicks);
const mockRefresh = jest.fn();
let mockProfile: ReturnType<typeof makeProfile> | null = makeProfile();
let mockSessionError: string | null = null;
let mockLoading = false;
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: mockLoading,
    error: mockSessionError,
    refreshProfile: mockRefresh,
  }),
}));

describe('You tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPickChanges();
    mockRefresh.mockResolvedValue(null);
    mockGetPicks.mockResolvedValue([]);
    mockProfile = makeProfile();
    mockSessionError = null;
    mockLoading = false;
  });

  it('shows the profile: name, handle, bio, city and stats', async () => {
    await render(<You />);
    expect(screen.getByText('@josiehamilton')).toBeOnTheScreen();
    expect(screen.getByText('Josie Hamilton')).toBeOnTheScreen();
    expect(screen.getByText('Chasing the perfect meal.')).toBeOnTheScreen();
    expect(screen.getByText('Vancouver, BC, Canada')).toBeOnTheScreen();
    expect(screen.getByText('0 followers')).toBeOnTheScreen();
    expect(screen.getByText('1 following')).toBeOnTheScreen();
    expect(screen.getByText('0 dishes')).toBeOnTheScreen();
  });

  it('uses singular follower and dish at 1', async () => {
    mockGetPicks.mockResolvedValue([makePick()]);
    mockProfile = makeProfile({ counts: { followers: 1, following: 1, dishes: 1 } });
    await render(<You />);
    expect(screen.getByText('1 follower')).toBeOnTheScreen();
    expect(await screen.findByText('1 dish')).toBeOnTheScreen();
  });

  it('hides the home city when showHomeCity is false, or when none is set', async () => {
    mockProfile = makeProfile({ showHomeCity: false });
    const view = await render(<You />);
    expect(screen.queryByText('Vancouver, BC, Canada')).toBeNull();
    await view.unmount();
    mockProfile = makeProfile({ homeCity: null });
    await render(<You />);
    expect(screen.queryByTestId('home-city')).toBeNull();
  });

  it('shows initials when there is no photo, and no bio line without a bio', async () => {
    mockProfile = makeProfile({ bio: null });
    await render(<You />);
    expect(screen.getByText('JH')).toBeOnTheScreen();
    expect(screen.queryByText('Chasing the perfect meal.')).toBeNull();
  });

  it('shows five empty seats, each offering Add a dish, when there are no picks', async () => {
    await render(<You />);
    for (const n of [1, 2, 3, 4, 5]) expect(await screen.findByTestId(`seat-${n}`)).toBeOnTheScreen();
    expect(screen.getAllByText('Add a dish')).toHaveLength(5);
    expect(screen.getByRole('tab', { name: 'Final Meal 0' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Honorable 0' })).toBeOnTheScreen();
  });

  it('has no filter chips with no picks, and never shows Share a list or Share these before Phase 6', async () => {
    await render(<You />);
    await screen.findByTestId('seat-1');
    expect(screen.queryByTestId('filter-chips')).toBeNull();
    expect(screen.queryByText('Share a list')).toBeNull();
    expect(screen.queryByText('Share these')).toBeNull();
  });

  it('switches between Final Meal, Honorable and Map', async () => {
    await render(<You />);
    expect(await screen.findByRole('tab', { name: 'Final Meal 0' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Honorable 0' }));
    expect(screen.getByText('No honorable mentions yet.')).toBeOnTheScreen();
    expect(screen.queryByTestId('seat-1')).toBeNull();
    await fireEvent.press(screen.getByRole('tab', { name: 'Map' }));
    expect(screen.getByText('Your map fills in as you add dishes.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Final Meal 0' }));
    expect(screen.getByTestId('seat-1')).toBeOnTheScreen();
  });

  describe("with Josie's seeded picks", () => {
    beforeEach(() => {
      mockGetPicks.mockResolvedValue(seedPicks());
    });
    const chip = (name: string) => screen.getByRole('button', { name });

    it('shows the 4 finals and One seat left. Choose wisely.', async () => {
      await render(<You />);
      expect(await screen.findByText('Pork Gyro')).toBeOnTheScreen();
      expect(screen.getByText('Wagyu Beef Don')).toBeOnTheScreen();
      expect(screen.getByText('Plain Biryani')).toBeOnTheScreen();
      expect(screen.getByText('Lobster Roll')).toBeOnTheScreen();
      expect(screen.getByText('4th Ave · Vancouver')).toBeOnTheScreen();
      expect(screen.getByText('One seat left. Choose wisely.')).toBeOnTheScreen();
      expect(screen.queryByText('Add a dish')).toBeNull();
      expect(mockGetPicks).toHaveBeenCalledWith({ fake: 'client' });
    });

    it('counts the tabs and shows the total pick count as the dishes stat', async () => {
      // The profile's own count is stale on purpose: the stat follows the picks on screen.
      mockProfile = makeProfile({ counts: { followers: 0, following: 1, dishes: 3 } });
      await render(<You />);
      expect(await screen.findByRole('tab', { name: 'Final Meal 4' })).toBeSelected();
      expect(screen.getByRole('tab', { name: 'Honorable 13' })).toBeOnTheScreen();
      expect(screen.getByRole('tab', { name: 'Map' })).toBeOnTheScreen();
      expect(screen.getByText('17 dishes')).toBeOnTheScreen();
    });

    it('opens a final in the pick detail', async () => {
      await render(<You />);
      await fireEvent.press(await screen.findByRole('button', { name: /^2\. Wagyu Beef Don/ }));
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/f2');
    });

    it('shows the honorables grouped by restaurant, 2 dishes for Marutama', async () => {
      await render(<You />);
      await fireEvent.press(await screen.findByRole('tab', { name: 'Honorable 13' }));
      expect(screen.getAllByTestId(/^group-/)).toHaveLength(11);
      const marutama = within(screen.getByTestId('group-pl-marutama'));
      expect(marutama.getByText('2 dishes')).toBeOnTheScreen();
      expect(marutama.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
      expect(marutama.getByText('Pork Gyoza')).toBeOnTheScreen();
      expect(screen.queryByText('Pork Gyro')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: /^Tonkotsu Ramen/ }));
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/h1');
    });

    it('offers the chips under the tabs: All, the cities, then the tags', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      expect(screen.getByTestId('filter-chips')).toBeOnTheScreen();
      expect(chip('All')).toBeSelected();
      for (const name of ['Vancouver', 'Tokyo', 'New York', 'Sushi', 'Gluten-free', 'Splurge']) {
        expect(chip(name)).toBeOnTheScreen();
      }
      expect(screen.queryByText(/ picks? at /)).toBeNull();
    });

    it('filters to Vancouver: 8 picks at 6 spots, the honorables of 5 spots, Share these still hidden', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      await fireEvent.press(chip('Vancouver'));
      expect(chip('Vancouver')).toBeSelected();
      expect(screen.getByText('Vancouver · 8 picks at 6 spots')).toBeOnTheScreen();
      expect(screen.queryByText('Share these')).toBeNull();
      // Tab counts follow the filter, as on the ProfileHM board: 1 final and 7 honorables.
      expect(screen.getByRole('tab', { name: 'Final Meal 1' })).toBeSelected();
      await fireEvent.press(screen.getByRole('tab', { name: 'Honorable 7' }));
      expect(screen.getAllByTestId(/^group-/)).toHaveLength(5);
      expect(screen.queryByTestId('group-pl-sushi-dai')).toBeNull();
      expect(screen.getByText('Vancouver · 8 picks at 6 spots')).toBeOnTheScreen();
    });

    it('dims the finals that do not match, keeping them and their slot numbers', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      await fireEvent.press(chip('Vancouver'));
      expect(screen.getByTestId('final-row-f1')).toHaveStyle({ opacity: 1 });
      for (const id of ['f2', 'f3', 'f4']) {
        expect(screen.getByTestId(`final-row-${id}`)).toHaveStyle({ opacity: 0.35 });
      }
      expect(screen.getByRole('button', { name: /^4\. Lobster Roll/ })).toBeOnTheScreen();
    });

    it('filters by a food tag and by a personal tag', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      await fireEvent.press(chip('Sushi'));
      expect(screen.getByText('Sushi · 4 picks at 4 spots')).toBeOnTheScreen();
      await fireEvent.press(chip('Splurge'));
      expect(chip('Splurge')).toBeSelected();
      expect(chip('Sushi')).not.toBeSelected();
      expect(screen.getByText('Splurge · 1 pick at 1 spot')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('tab', { name: 'Honorable 1' }));
      expect(screen.getAllByTestId(/^group-/)).toHaveLength(1);
      expect(screen.getByText('Omakase')).toBeOnTheScreen();
    });

    it('goes back to everything on All', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      await fireEvent.press(chip('Tokyo'));
      await fireEvent.press(chip('All'));
      expect(chip('All')).toBeSelected();
      expect(screen.queryByText(/ picks? at /)).toBeNull();
      expect(screen.getByRole('tab', { name: 'Final Meal 4' })).toBeOnTheScreen();
      expect(screen.getByTestId('final-row-f2')).toHaveStyle({ opacity: 1 });
    });

    it('says so when a filter leaves no honorable mentions', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      await fireEvent.press(chip('Portland'));
      await fireEvent.press(screen.getByRole('tab', { name: 'Honorable 0' }));
      expect(screen.getByText('No honorable mentions match this filter.')).toBeOnTheScreen();
      expect(screen.queryByText('No honorable mentions yet.')).toBeNull();
    });

    it('hides the chip row on the Map tab, which keeps its Phase 2 copy', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      await fireEvent.press(screen.getByRole('tab', { name: 'Map' }));
      expect(screen.getByText('Your map fills in as you add dishes.')).toBeOnTheScreen();
      expect(screen.queryByTestId('filter-chips')).toBeNull();
    });

    it('drops a filter whose chip is gone after the picks change', async () => {
      await render(<You />);
      await screen.findByText('Pork Gyro');
      await fireEvent.press(chip('Portland'));
      mockGetPicks.mockResolvedValue(seedPicks().filter((p) => p.place.city !== 'Portland'));
      await act(async () => announcePicksChanged());
      expect(screen.queryByRole('button', { name: 'Portland' })).toBeNull();
      expect(chip('All')).toBeSelected();
      expect(screen.queryByText(/ picks? at /)).toBeNull();
      expect(screen.getByTestId('final-row-f3')).toHaveStyle({ opacity: 1 });
    });
  });

  describe('with fewer than four finals', () => {
    it('shows Add a dish seats that open the add modal with Final Meal preselected', async () => {
      mockGetPicks.mockResolvedValue(makeFinals(2));
      await render(<You />);
      await screen.findByText('Dish 2');
      expect(screen.getAllByText('Add a dish')).toHaveLength(3);
      await fireEvent.press(screen.getAllByRole('button', { name: /^Add a dish/ })[0]!);
      expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/add', params: { tier: 'final' } });
    });

    it('opens the add modal from the last seat too', async () => {
      mockGetPicks.mockResolvedValue(makeFinals(4));
      await render(<You />);
      await fireEvent.press(await screen.findByRole('button', { name: 'One seat left. Choose wisely.' }));
      expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/add', params: { tier: 'final' } });
    });

    it('shows the filter chips as soon as there is one pick', async () => {
      mockGetPicks.mockResolvedValue([makePick({ id: 'h1', tier: 'honorable', slot: null })]);
      await render(<You />);
      expect(await screen.findByTestId('filter-chips')).toBeOnTheScreen();
    });
  });

  describe('loading the picks', () => {
    it('reloads them on pull to refresh, with the profile', async () => {
      mockGetPicks.mockResolvedValue(seedPicks());
      await render(<You />);
      await screen.findByText('Pork Gyro');
      mockGetPicks.mockResolvedValue(makeFinals(1));
      await act(async () => {
        await screen.getByTestId('you-scroll').props.refreshControl.props.onRefresh();
      });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(await screen.findByText('Dish 1')).toBeOnTheScreen();
      expect(screen.queryByText('Pork Gyro')).toBeNull();
    });

    it('reloads them when the picks change elsewhere', async () => {
      mockGetPicks.mockResolvedValue(makeFinals(1));
      await render(<You />);
      await screen.findByText('Dish 1');
      mockGetPicks.mockResolvedValue(makeFinals(2));
      await act(async () => announcePicksChanged());
      expect(await screen.findByText('Dish 2')).toBeOnTheScreen();
    });

    it('shows friendly copy and a Try again when they cannot be loaded', async () => {
      mockGetPicks.mockRejectedValueOnce(new TypeError('Network request failed'));
      await render(<You />);
      expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      mockGetPicks.mockResolvedValue(makeFinals(1));
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Dish 1')).toBeOnTheScreen();
      expect(screen.queryByText('Can’t reach the kitchen right now.')).toBeNull();
    });
  });

  it('opens Settings and Edit profile', async () => {
    await render(<You />);
    await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
    await fireEvent.press(screen.getByRole('button', { name: 'Edit profile' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/edit-profile');
  });

  it('pull to refresh reloads the profile', async () => {
    await render(<You />);
    const refresh = screen.getByTestId('you-scroll').props.refreshControl.props.onRefresh;
    await refresh();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows friendly copy when the refresh fails', async () => {
    mockRefresh.mockRejectedValue(new TypeError('Network request failed'));
    await render(<You />);
    await screen.getByTestId('you-scroll').props.refreshControl.props.onRefresh();
    expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
  });

  describe('without a profile', () => {
    beforeEach(() => {
      mockProfile = null;
    });

    it('shows the session error with a Try again button instead of a blank screen', async () => {
      mockSessionError = 'Can’t reach the kitchen right now.';
      await render(<You />);
      expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    });

    it('falls back to the generic copy when there is no error to show', async () => {
      await render(<You />);
      expect(screen.getByText('Something went wrong. Try again.')).toBeOnTheScreen();
    });

    it('reloads the profile on Try again, showing a spinner meanwhile', async () => {
      let finish: (value: null) => void = () => {};
      mockRefresh.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      await render(<You />);
      void fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(await screen.findByTestId('you-loading')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      await act(async () => finish(null));
      expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    });

    it('shows the new friendly copy when Try again fails', async () => {
      mockRefresh.mockRejectedValue(new TypeError('Network request failed'));
      await render(<You />);
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    });

    it('shows a spinner while the session is still loading', async () => {
      mockLoading = true;
      await render(<You />);
      expect(screen.getByTestId('you-loading')).toBeOnTheScreen();
    });
  });

  describe('after saving a dish', () => {
    it('shows the saved-without-photo banner, which can be dismissed', async () => {
      await render(<You />);
      expect(screen.queryByText('Saved without the photo. Add it from the dish any time.')).toBeNull();
      await act(async () => announcePicksChanged({ photoFailed: true }));
      expect(
        screen.getByText('Saved without the photo. Add it from the dish any time.'),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText('Saved without the photo. Add it from the dish any time.')).toBeNull();
    });

    it('refreshes the profile (the dish count) when picks change', async () => {
      await render(<You />);
      expect(mockRefresh).not.toHaveBeenCalled();
      await act(async () => announcePicksChanged());
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
