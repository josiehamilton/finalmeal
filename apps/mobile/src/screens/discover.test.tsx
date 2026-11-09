import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import {
  ApiError,
  getCity,
  getDishesInView,
  getPicksInView,
  nearestCity,
  searchTags,
} from '@finalmeal/api';
import type { DiscoverFilters } from '@finalmeal/core';
import { DEFAULT_DISCOVER_FILTERS } from '@finalmeal/core';
import Discover from '../../app/(app)/(tabs)/discover';
import { FOCUS_ZOOM, WORLD_CAMERA } from '../map/camera';
import { pinsForDiscover } from '../map/pins';
import {
  VANCOUVER_REGION,
  makeDiscoverDishes,
  makeDiscoverPlaces,
  makeKinKaoSelection,
} from '../test-support/discover';
import { currentWebView, emitMapEvent, resetMapMock, sentCommands } from '../test-support/map';
import { makeProfile } from '../test-support/profile';

const mockRouter = { push: jest.fn(), setParams: jest.fn(), back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
const client = { fake: 'client' };
jest.mock('../lib/supabase', () => ({ getSupabase: () => client }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getCity: jest.fn(),
  getPicksInView: jest.fn(),
  getDishesInView: jest.fn(),
  nearestCity: jest.fn(),
  searchTags: jest.fn(),
}));
let mockProfile = makeProfile();
let mockSessionLoading = false;
jest.mock('../providers/SessionProvider', () => ({
  useSession: () => ({
    session: {},
    profile: mockProfile,
    loading: mockSessionLoading,
    error: null,
    refreshProfile: jest.fn().mockResolvedValue(null),
  }),
}));
const mockPicks = jest.mocked(getPicksInView);
const mockDishes = jest.mocked(getDishesInView);

const SUSHI = { id: 't-sushi', kind: 'food_type', name: 'Sushi', slug: 'sushi', featured: true } as const;
const NOODLES = { id: 't-noodles', kind: 'food_type', name: 'Noodles', slug: 'noodles', featured: true } as const;
const GLUTEN_FREE = { id: 't-gf', kind: 'dietary', name: 'Gluten-free', slug: 'gluten-free', featured: true } as const;
const KOREAN = { id: 't-korean', kind: 'food_type', name: 'Korean', slug: 'korean', featured: false } as const;

async function settle(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Mounts Discover, lets the home city and the first load land, and tells it the map is ready. */
async function show() {
  await render(<Discover />);
  await settle();
  await emitMapEvent({ type: 'ready' });
  await settle();
}

function lastFilters(): DiscoverFilters {
  return mockPicks.mock.calls[mockPicks.mock.calls.length - 1]![2];
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetMapMock();
  mockParams = {};
  mockProfile = makeProfile();
  mockSessionLoading = false;
  jest.mocked(getCity).mockResolvedValue({ id: 'c1', lat: 49.2827, lng: -123.1207 } as never);
  jest.mocked(nearestCity).mockResolvedValue({ id: 'c1', name: 'Vancouver' } as never);
  mockPicks.mockImplementation(async (_c, _b, filters) => ({
    places:
      filters.foodTypeIds.length > 0
        ? makeDiscoverPlaces().slice(0, 2) // 5 + 4 picks
        : makeDiscoverPlaces(),
    truncated: false,
  }));
  mockDishes.mockImplementation(async (_c, _b, _f, _center, opts) =>
    opts?.placeId ? makeKinKaoSelection() : makeDiscoverDishes(),
  );
  jest.mocked(searchTags).mockImplementation(async (_c, kind, q) => {
    if (q === '') return kind === 'dietary' ? [GLUTEN_FREE] : [SUSHI, NOODLES];
    return q === 'kor' ? [KOREAN] : [];
  });
});
afterEach(() => jest.useRealTimers());

describe('Discover tab: the map and the in-view sheet', () => {
  it('opens at the home city and sends the places to the map as pins', async () => {
    await show();
    expect(currentWebView().source?.html).toContain('"camera":{"lat":49.2827,"lng":-123.1207,"zoom":12}');
    const pins = sentCommands().filter((c) => c.type === 'setPins');
    expect(pins[pins.length - 1]).toEqual({ type: 'setPins', pins: pinsForDiscover(makeDiscoverPlaces()) });
  });

  it('reads the count, the city and the first card from the data', async () => {
    await show();
    expect(screen.getByText('12 picks near Vancouver')).toBeOnTheScreen();
    expect(screen.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
    expect(screen.getByText('Marutama')).toBeOnTheScreen();
    expect(screen.getByText('Final Meal · 14 lists')).toBeOnTheScreen();
    expect(screen.getByText('Honorable · 6 lists')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'List view' })).toBeOnTheScreen();
  });

  it('opens a card’s pick, and a card with no pick to open is not a button', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: /^Tonkotsu Ramen/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-tonkotsu');
    expect(screen.queryByRole('button', { name: /^Pork Gyro/ })).toBeNull();
    expect(screen.getByText('Pork Gyro')).toBeOnTheScreen();
  });

  it('shows the selected spot when a pin is tapped, and the in-view sheet again on a map tap', async () => {
    await show();
    await emitMapEvent({ type: 'pinPress', id: 'pl-kinkao' });
    await settle();
    expect(mockDishes).toHaveBeenLastCalledWith(client, null, DEFAULT_DISCOVER_FILTERS, expect.anything(), {
      placeId: 'pl-kinkao',
    });
    const sheet = within(screen.getByLabelText('Selected pick'));
    expect(sheet.getByText('Honorable')).toBeOnTheScreen();
    expect(sheet.getByText('Khao Soi')).toBeOnTheScreen();
    expect(sheet.getByText('Kin Kao · Main St · 1.8 km')).toBeOnTheScreen();
    expect(sheet.getAllByTestId('selected-avatar')).toHaveLength(2);
    expect(sheet.getByText('Honorable for 6 people · Final Meal for 2')).toBeOnTheScreen();
    expect(screen.queryByText('12 picks near Vancouver')).toBeNull();
    expect(sentCommands().filter((c) => c.type === 'select').pop()).toEqual({ type: 'select', id: 'pl-kinkao' });
    await fireEvent.press(screen.getByRole('button', { name: /^Khao Soi/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-khaosoi');

    await emitMapEvent({ type: 'mapPress' });
    await settle();
    expect(screen.getByText('12 picks near Vancouver')).toBeOnTheScreen();
    expect(sentCommands().filter((c) => c.type === 'select').pop()).toEqual({ type: 'select', id: null });
  });

  it('says there are no picks here when the view is empty', async () => {
    mockPicks.mockResolvedValue({ places: [], truncated: false });
    mockDishes.mockResolvedValue([]);
    await show();
    expect(screen.getByText('No picks here yet.')).toBeOnTheScreen();
    expect(screen.getByText('Move the map or zoom out to find more.')).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Reset filters' })).toBeNull();
  });

  it('offers Reset filters when a filter has emptied the view', async () => {
    await show();
    mockPicks.mockResolvedValue({ places: [], truncated: false });
    mockDishes.mockResolvedValue([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Final Meals' }));
    await settle();
    expect(screen.getByText('No picks match these filters.')).toBeOnTheScreen();
    mockPicks.mockResolvedValue({ places: makeDiscoverPlaces(), truncated: false });
    mockDishes.mockResolvedValue(makeDiscoverDishes());
    await fireEvent.press(screen.getByRole('link', { name: 'Reset filters' }));
    await settle();
    expect(lastFilters()).toEqual(DEFAULT_DISCOVER_FILTERS);
    expect(screen.getByText('12 picks near Vancouver')).toBeOnTheScreen();
  });

  it('asks to zoom in when there are more places than pins', async () => {
    mockPicks.mockResolvedValue({ places: makeDiscoverPlaces(), truncated: true });
    await show();
    expect(screen.getByText('Zoom in to see every pick.')).toBeOnTheScreen();
  });

  it('shows the friendly copy with Try again when loading fails, and recovers', async () => {
    mockPicks.mockRejectedValueOnce(new ApiError('x', 'network'));
    await show();
    expect(screen.getByText('Can’t reach the kitchen right now.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(screen.getByText('12 picks near Vancouver')).toBeOnTheScreen();
  });

  it('starts at the world view with no home city, asks for one, and still shows the cards', async () => {
    mockProfile = makeProfile({ homeCity: null });
    await show();
    expect(getCity).not.toHaveBeenCalled();
    expect(currentWebView().source?.html).toContain(JSON.stringify({ lat: 20, lng: 0, zoom: 1.5 }));
    expect(WORLD_CAMERA).toEqual({ lat: 20, lng: 0, zoom: 1.5 });
    expect(screen.getByText('Set your home city to start the map there.')).toBeOnTheScreen();
    expect(screen.getByText('Tonkotsu Ramen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose home city' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/settings/home-city');
    // Zooming in is no longer the world view.
    await emitMapEvent({ type: 'region', region: { ...VANCOUVER_REGION, zoom: 11 } });
    await settle(250);
    expect(screen.queryByText('Set your home city to start the map there.')).toBeNull();
  });

  it('keeps the chips and the list working when the map does not load', async () => {
    await render(<Discover />);
    await settle();
    await emitMapEvent({ type: 'error', reason: 'load' });
    expect(screen.getByText('The map didn’t load.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Final Meals' })).toBeOnTheScreen();
    expect(screen.getByText('12 picks near Vancouver')).toBeOnTheScreen();
  });
});

describe('Discover tab: selected spot, zoom and session', () => {
  it('closes the selected spot with a visible Close button, back to the in-view sheet and List view', async () => {
    await show();
    await emitMapEvent({ type: 'pinPress', id: 'pl-kinkao' });
    await settle();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('12 picks near Vancouver')).toBeOnTheScreen();
    expect(sentCommands().filter((c) => c.type === 'select').pop()).toEqual({ type: 'select', id: null });
    await fireEvent.press(screen.getByRole('link', { name: 'List view' }));
    await settle();
    expect(screen.getByTestId('discover-list')).toBeOnTheScreen();
  });

  it('closes the selected spot on an accessibility escape', async () => {
    await show();
    await emitMapEvent({ type: 'pinPress', id: 'pl-kinkao' });
    await settle();
    await fireEvent(screen.getByLabelText('Selected pick'), 'accessibilityEscape');
    expect(screen.getByText('12 picks near Vancouver')).toBeOnTheScreen();
  });

  it('does not reload the view or move the map’s padding when a pin is tapped', async () => {
    await show();
    const insetsBefore = sentCommands().filter((c) => c.type === 'setInsets');
    const loads = mockPicks.mock.calls.length;
    await emitMapEvent({ type: 'pinPress', id: 'pl-kinkao' });
    await settle();
    await fireEvent(screen.getByLabelText('Selected pick'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 360 } },
    });
    // The map answers the padding change with a region at the same centre and zoom.
    await emitMapEvent({
      type: 'region',
      region: { ...VANCOUVER_REGION, center: { lat: 49.2827, lng: -123.1207 }, zoom: 12 },
    });
    await settle(250);
    expect(mockPicks.mock.calls.length).toBe(loads);
    expect(sentCommands().filter((c) => c.type === 'setInsets')).toEqual(insetsBefore);
  });

  it('names no city when zoomed out', async () => {
    await show();
    await emitMapEvent({ type: 'region', region: { ...VANCOUVER_REGION, zoom: 6 } });
    await settle(250);
    expect(screen.getByText('12 picks here')).toBeOnTheScreen();
  });

  it('waits for the session before it starts the map', async () => {
    mockSessionLoading = true;
    await render(<Discover />);
    await settle();
    expect(getCity).not.toHaveBeenCalled();
    expect(mockPicks).not.toHaveBeenCalled();
    expect(screen.queryByText('Set your home city to start the map there.')).toBeNull();
  });

  it('keeps List view and Filters working when the map did not load', async () => {
    await render(<Discover />);
    await settle();
    await emitMapEvent({ type: 'error', reason: 'load' });
    await fireEvent.press(screen.getByRole('link', { name: 'List view' }));
    await settle();
    expect(screen.getByTestId('discover-list')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Close filters' })).toBeOnTheScreen();
  });
});

describe('Discover tab: the chip row, search and focus', () => {
  it('sets the tier from the chips and toggles Following on its own', async () => {
    await show();
    expect(screen.getByRole('button', { name: 'All' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Final Meals' }));
    expect(lastFilters()).toEqual({ ...DEFAULT_DISCOVER_FILTERS, tier: 'final' });
    expect(screen.getByRole('button', { name: 'Final Meals' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Following' }));
    expect(lastFilters()).toEqual({ ...DEFAULT_DISCOVER_FILTERS, tier: 'final', followingOnly: true });
    expect(screen.getByRole('button', { name: 'Final Meals' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(lastFilters()).toEqual({ ...DEFAULT_DISCOVER_FILTERS, followingOnly: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Following' }));
    expect(lastFilters()).toEqual(DEFAULT_DISCOVER_FILTERS);
    await settle();
  });

  it('opens Search from the map’s centre', async () => {
    await show();
    await emitMapEvent({ type: 'region', region: VANCOUVER_REGION });
    await fireEvent.press(screen.getByRole('button', { name: 'Search dishes, spots, people' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/search?from=discover&lat=49.275&lng=-123.1');
    await settle(250);
  });

  it('flies to a place Search sent and selects it once its pin is loaded', async () => {
    mockParams = { placeId: 'pl-kinkao', lat: '49.26', lng: '-123.1' };
    await show();
    expect(sentCommands()).toContainEqual({
      type: 'flyTo',
      camera: { lat: 49.26, lng: -123.1, zoom: FOCUS_ZOOM },
    });
    expect(mockRouter.setParams).toHaveBeenCalledWith({ placeId: undefined, lat: undefined, lng: undefined });
    expect(mockDishes).toHaveBeenCalledWith(client, null, DEFAULT_DISCOVER_FILTERS, expect.anything(), {
      placeId: 'pl-kinkao',
    });
    expect(screen.getByText('Kin Kao · Main St · 1.8 km')).toBeOnTheScreen();
  });
});

describe('Discover tab: List view', () => {
  it('lists the dishes as rows, opens a pick, and goes back to the map', async () => {
    await show();
    await fireEvent.press(screen.getByRole('link', { name: 'List view' }));
    await settle();
    expect(mockDishes).toHaveBeenLastCalledWith(
      client,
      expect.objectContaining({ west: expect.any(Number) }),
      DEFAULT_DISCOVER_FILTERS,
      expect.anything(),
      { limit: 50 },
    );
    const list = screen.getByTestId('discover-list');
    expect(within(list).getByText('Khao Soi')).toBeOnTheScreen();
    expect(within(list).getByText('Kin Kao · 1.8 km')).toBeOnTheScreen();
    expect(within(list).getByText('14 lists')).toBeOnTheScreen();
    await fireEvent.press(within(list).getByRole('button', { name: /^Tonkotsu Ramen/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/pick/pk-tonkotsu');
    await fireEvent.press(within(list).getByRole('link', { name: 'Map view' }));
    expect(screen.queryByTestId('discover-list')).toBeNull();
  });

  it('selects the place for a row with no pick to open, and returns to the map', async () => {
    await show();
    await fireEvent.press(screen.getByRole('link', { name: 'List view' }));
    await settle();
    await fireEvent.press(within(screen.getByTestId('discover-list')).getByRole('button', { name: /^Pork Gyro/ }));
    await settle();
    expect(screen.queryByTestId('discover-list')).toBeNull();
    expect(sentCommands().filter((c) => c.type === 'select').pop()).toEqual({ type: 'select', id: 'pl-skewers' });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('Discover tab: Filters', () => {
  async function openFilters() {
    await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
    await settle();
  }

  function moveSlider(km: number) {
    return fireEvent(screen.getByLabelText('Distance in kilometres'), 'change', {
      nativeEvent: { value: km },
    });
  }

  it('counts the draft, applies it, and shows the Filters dot with how many are on', async () => {
    await show();
    expect(screen.queryByTestId('filters-dot')).toBeNull();
    await openFilters();
    expect(screen.getByText('Any')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sushi' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Noodles' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Gluten-free' }));
    await moveSlider(25);
    expect(screen.getByText('25 km')).toBeOnTheScreen();
    await settle(300);
    expect(lastFilters()).toEqual({
      ...DEFAULT_DISCOVER_FILTERS,
      radiusKm: 25,
      foodTypeIds: ['t-sushi', 't-noodles'],
      dietaryIds: ['t-gf'],
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Show 9 picks' }));
    await settle();
    expect(screen.queryByRole('button', { name: 'Show 9 picks' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAccessibilityValue({ text: '4 on' });
    expect(screen.getByTestId('filters-dot')).toBeOnTheScreen();
  });

  it('reads Any again with the slider at 100, and says when nothing matches or one pick does', async () => {
    await show();
    await openFilters();
    await moveSlider(25);
    await moveSlider(100);
    expect(screen.getByText('Any')).toBeOnTheScreen();
    mockPicks.mockResolvedValue({ places: [], truncated: false });
    await moveSlider(3);
    await settle(300);
    expect(screen.getByRole('button', { name: 'No picks match' })).toBeOnTheScreen();
    mockPicks.mockResolvedValue({ places: [{ ...makeDiscoverPlaces()[0]!, pickCount: 1 }], truncated: false });
    await moveSlider(4);
    await settle(300);
    expect(screen.getByRole('button', { name: 'Show 1 pick' })).toBeOnTheScreen();
  });

  it('throws the draft away when the backdrop is tapped', async () => {
    await show();
    await openFilters();
    await fireEvent.press(screen.getByRole('button', { name: 'Sushi' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close filters' }));
    await settle();
    expect(screen.queryByTestId('filters-dot')).toBeNull();
    expect(lastFilters()).toEqual(DEFAULT_DISCOVER_FILTERS);
    await openFilters();
    expect(screen.getByRole('button', { name: 'Sushi' })).not.toBeSelected();
  });

  it('keeps Following on Reset', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Following' }));
    await settle();
    await openFilters();
    await fireEvent.press(screen.getByRole('button', { name: 'Sushi' }));
    await moveSlider(10);
    await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
    await settle(300);
    expect(lastFilters()).toEqual({ ...DEFAULT_DISCOVER_FILTERS, followingOnly: true });
    expect(screen.getByText('Any')).toBeOnTheScreen();
  });

  it('searches with More: typing kor lists Korean in the group', async () => {
    await show();
    await openFilters();
    const more = screen.getAllByRole('button', { name: 'More' });
    expect(more).toHaveLength(2);
    await fireEvent.press(more[0]!);
    await fireEvent.changeText(screen.getByLabelText('Search food types'), 'kor');
    await settle(300);
    expect(searchTags).toHaveBeenCalledWith(client, 'food_type', 'kor', 10);
    await fireEvent.press(screen.getByRole('button', { name: 'Korean' }));
    expect(screen.getByRole('button', { name: 'Korean' })).toBeSelected();
  });
});
