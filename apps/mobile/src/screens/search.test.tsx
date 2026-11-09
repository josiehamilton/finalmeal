import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  getCity,
  getSuggestedPeople,
  searchDishes,
  searchPeople,
  searchPlaces,
} from '@finalmeal/api';
import Search from '../../app/(app)/search';
import { clearFollowStates } from '../state/follow-store';
import { PLACE } from '../test-support/add-dish';
import { makeDiscoverDish } from '../test-support/discover';
import { makePerson, makeSuggested } from '../test-support/people';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() };
let mockParams: Record<string, string> = { from: 'feed' };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getCity: jest.fn(),
  getSuggestedPeople: jest.fn(),
  searchPeople: jest.fn(),
  searchDishes: jest.fn(),
  searchPlaces: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
}));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ fake: 'client' }) }));
const mockProfile = makeProfile();
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({ session: {}, profile: mockProfile, loading: false, error: null }),
}));
const mockCity = jest.mocked(getCity);
const mockSuggested = jest.mocked(getSuggestedPeople);
const mockPeople = jest.mocked(searchPeople);
const mockDishes = jest.mocked(searchDishes);
const mockPlaces = jest.mocked(searchPlaces);
const client = { fake: 'client' };
const HOME = { lat: 49.2827, lng: -123.1207 };
const SPOT = { ...PLACE, lat: 49.2935, lng: -123.1207, distanceM: 1201 as number | null };

async function type(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Search'), text);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
}

async function show() {
  await render(<Search />);
  await act(async () => {});
}

describe('Search', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clearFollowStates();
    mockParams = { from: 'feed' };
    mockCity.mockResolvedValue({ id: 'c1', label: 'Vancouver, BC, Canada', ...HOME } as never);
    mockSuggested.mockResolvedValue([
      makeSuggested({
        id: 'u2',
        username: 'mikebrennan',
        displayName: 'Mike Brennan',
        topDish: 'Wagyu Beef Don',
      }),
      makeSuggested({ id: 'u5', username: 'devpatel', displayName: 'Dev Patel', topDish: null }),
    ]);
    mockPeople.mockResolvedValue([
      { ...makePerson(), followersCount: 567 },
      {
        ...makePerson({
          id: 'u6',
          username: 'arimitchell',
          displayName: 'Ari Mitchell',
          viewerFollow: 'active',
        }),
        followersCount: 1,
      },
    ]);
    mockDishes.mockResolvedValue([makeDiscoverDish({ distanceM: 1234 })]);
    mockPlaces.mockResolvedValue([SPOT]);
  });
  afterEach(() => jest.useRealTimers());

  describe('from the Feed', () => {
    it('has the field, Cancel and the three tabs with People first', async () => {
      await show();
      expect(screen.getByLabelText('Search')).toBeOnTheScreen();
      expect(screen.getByPlaceholderText('Dishes, spots, people')).toBeOnTheScreen();
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(['People', 'Dishes', 'Spots']);
      expect(tabs[0]!.props.accessibilityState).toMatchObject({ selected: true });
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockRouter.back).toHaveBeenCalled();
    });

    it('with no text shows only Suggested for you', async () => {
      await show();
      expect(mockSuggested).toHaveBeenCalledWith(client, 20);
      expect(await screen.findByText('Suggested for you')).toBeOnTheScreen();
      expect(screen.getByText('#1 · Wagyu Beef Don')).toBeOnTheScreen();
      expect(screen.getByText('@devpatel')).toBeOnTheScreen();
      expect(mockPeople).not.toHaveBeenCalled();
    });

    it('finds people, then Suggested for you', async () => {
      await show();
      await type('al');
      expect(mockPeople).toHaveBeenCalledWith(client, 'al', 20);
      expect(mockSuggested).toHaveBeenLastCalledWith(client, 5);
      expect(await screen.findByText('Alli Mercer')).toBeOnTheScreen();
      expect(screen.getByText('@allimercer · 567 followers')).toBeOnTheScreen();
      expect(screen.getByText('@arimitchell · 1 follower')).toBeOnTheScreen();
      expect(screen.getAllByRole('button', { name: 'Follow' }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Following' })).toBeOnTheScreen();
      expect(screen.getByText('Suggested for you')).toBeOnTheScreen();
      expect(screen.getByText('Mike Brennan')).toBeOnTheScreen();
    });

    it('ignores a leading @', async () => {
      await show();
      await type('@al');
      expect(mockPeople).toHaveBeenCalledWith(client, 'al', 20);
    });

    it('lists dishes near the home city on the Dishes tab', async () => {
      await show();
      await type('ramen');
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      expect(await screen.findByText('Tonkotsu Ramen')).toBeOnTheScreen();
      expect(mockDishes).toHaveBeenCalledWith(client, 'ramen', HOME, 20);
      expect(screen.getByText('Marutama · 1.2 km')).toBeOnTheScreen();
      expect(screen.getByText('14 lists')).toBeOnTheScreen();
    });

    it('lists spots with their distance on the Spots tab', async () => {
      await show();
      await type('ramen');
      await fireEvent.press(screen.getByRole('tab', { name: 'Spots' }));
      expect(await screen.findByText('Marutama Ramen')).toBeOnTheScreen();
      expect(mockPlaces).toHaveBeenCalledWith(client, 'ramen', HOME, 20);
      expect(screen.getByText('Bidwell St · 1.2 km')).toBeOnTheScreen();
    });

    it('shows the place’s label when there is no distance', async () => {
      mockCity.mockResolvedValue(null);
      mockPlaces.mockResolvedValue([{ ...SPOT, distanceM: null }]);
      await show();
      await type('ramen');
      await fireEvent.press(screen.getByRole('tab', { name: 'Spots' }));
      expect(await screen.findByText('Bidwell St · Vancouver')).toBeOnTheScreen();
      expect(mockPlaces).toHaveBeenCalledWith(client, 'ramen', undefined, 20);
    });

    it('shows a spinner, not the empty copy, while the home city loads, and People does not wait', async () => {
      mockCity.mockReturnValue(new Promise(() => {}));
      await show();
      expect(screen.queryByText(/No suggestions yet/)).toBeNull();
      expect(await screen.findByText('Mike Brennan')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      await type('ramen');
      expect(screen.getByTestId('search-loading')).toBeOnTheScreen();
      expect(mockDishes).not.toHaveBeenCalled();
    });

    it('starts on a spinner before the first answer', async () => {
      mockSuggested.mockReturnValue(new Promise(() => {}));
      await show();
      expect(screen.getByTestId('search-loading')).toBeOnTheScreen();
      expect(screen.queryByText(/No suggestions yet/)).toBeNull();
    });

    it('does not ask again for people when the home city arrives', async () => {
      await show();
      await screen.findByText('Mike Brennan');
      expect(mockSuggested).toHaveBeenCalledTimes(1);
    });

    it('ignores a leading @ on the Dishes tab, and clears with the Clear button', async () => {
      await show();
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      await type('@ramen');
      expect(mockDishes).toHaveBeenCalledWith(client, 'ramen', HOME, 20);
      await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
      expect(screen.getByLabelText('Search').props.value).toBe('');
    });

    it('opens a person', async () => {
      await show();
      await type('al');
      await fireEvent.press(await screen.findByText('Alli Mercer'));
      expect(mockRouter.push).toHaveBeenCalledWith('/u/u4');
    });

    it('says when nothing matches', async () => {
      mockDishes.mockResolvedValue([]);
      await show();
      await type('zzz');
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      expect(await screen.findByText('No matches for “zzz”.')).toBeOnTheScreen();
    });

    it('says when no one matches, and still suggests people', async () => {
      mockPeople.mockResolvedValue([]);
      await show();
      await type('zzz');
      expect(await screen.findByText('No matches for “zzz”.')).toBeOnTheScreen();
      expect(screen.getByText('Suggested for you')).toBeOnTheScreen();
    });

    it('drops a slow response when a newer one has arrived', async () => {
      let resolveSlow: (v: never) => void = () => {};
      mockDishes
        .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r as never)))
        .mockResolvedValueOnce([makeDiscoverDish({ dishId: 'd2', dishName: 'Shio Ramen' })]);
      await show();
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      await type('ra');
      await type('ram');
      expect(await screen.findByText('Shio Ramen')).toBeOnTheScreen();
      await act(async () => {
        resolveSlow([makeDiscoverDish({ dishName: 'Stale Dish' })] as never);
      });
      expect(screen.queryByText('Stale Dish')).toBeNull();
      expect(screen.getByText('Shio Ramen')).toBeOnTheScreen();
    });

    it('shows friendly copy and Try again', async () => {
      mockDishes.mockRejectedValueOnce(new Error('boom'));
      await show();
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      await type('ramen');
      expect(await screen.findByText('Something went wrong. Try again.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Tonkotsu Ramen')).toBeOnTheScreen();
    });

    it('opens a pick from a dish that has one', async () => {
      await show();
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      await type('ramen');
      await fireEvent.press(await screen.findByText('Tonkotsu Ramen'));
      expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-tonkotsu');
    });

    it('sends a dish without a pick, and a spot, to Discover', async () => {
      mockDishes.mockResolvedValue([makeDiscoverDish({ pickId: null })]);
      await show();
      await fireEvent.press(screen.getByRole('tab', { name: 'Dishes' }));
      await type('ramen');
      await fireEvent.press(await screen.findByText('Tonkotsu Ramen'));
      const focus = {
        pathname: '/discover',
        params: { placeId: 'pl-marutama', lat: 49.29, lng: -123.13 },
      };
      expect(mockRouter.navigate).toHaveBeenCalledWith(focus);
      await fireEvent.press(screen.getByRole('tab', { name: 'Spots' }));
      await fireEvent.press(await screen.findByText('Marutama Ramen'));
      expect(mockRouter.navigate).toHaveBeenLastCalledWith({
        pathname: '/discover',
        params: { placeId: 'p1', lat: 49.2935, lng: -123.1207 },
      });
    });
  });

  describe('from Discover', () => {
    const CENTRE = { lat: 49.275, lng: -123.1 };
    beforeEach(() => {
      mockParams = { from: 'discover', lat: '49.275', lng: '-123.1' };
    });

    it('has no tabs and says what to search before any text', async () => {
      await show();
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.getByText('Search dishes, spots and people.')).toBeOnTheScreen();
      expect(mockCity).not.toHaveBeenCalled();
    });

    it('shows Dishes, then Spots, then People, near the map’s centre', async () => {
      await show();
      await type('ramen');
      expect(await screen.findByText('Tonkotsu Ramen')).toBeOnTheScreen();
      expect(mockDishes).toHaveBeenCalledWith(client, 'ramen', CENTRE, 5);
      expect(mockPlaces).toHaveBeenCalledWith(client, 'ramen', CENTRE, 5);
      expect(mockPeople).toHaveBeenCalledWith(client, 'ramen', 3);
      const labels = screen.getAllByRole('header').map((h) => h.props.children);
      expect(labels).toEqual(['Dishes', 'Spots', 'People']);
      expect(screen.queryByText('Shared lists')).toBeNull();
    });

    it('hides a section with nothing in it', async () => {
      mockPlaces.mockResolvedValue([]);
      mockPeople.mockResolvedValue([]);
      await show();
      await type('ramen');
      await screen.findByText('Tonkotsu Ramen');
      expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['Dishes']);
    });

    it('says when nothing matches anywhere', async () => {
      mockDishes.mockResolvedValue([]);
      mockPlaces.mockResolvedValue([]);
      mockPeople.mockResolvedValue([]);
      await show();
      await type('zzz');
      expect(await screen.findByText('No matches for “zzz”.')).toBeOnTheScreen();
    });

    it('sends a spot to Discover', async () => {
      mockDishes.mockResolvedValue([]);
      await show();
      await type('ramen');
      await fireEvent.press(await screen.findByText('Marutama Ramen'));
      expect(mockRouter.navigate).toHaveBeenCalledWith({
        pathname: '/discover',
        params: { placeId: 'p1', lat: 49.2935, lng: -123.1207 },
      });
    });
  });
});
