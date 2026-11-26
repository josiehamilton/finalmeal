import { act, renderHook } from '@testing-library/react-native';
import { ApiError, getDishesInView, getPicksInView, nearestCity } from '@finalmeal/api';
import { DEFAULT_DISCOVER_FILTERS } from '@finalmeal/core';
import {
  VANCOUVER_REGION,
  makeDiscoverDishes,
  makeDiscoverPlaces,
  makeKinKaoSelection,
} from '../test-support/discover';
import { useDiscover } from './discover';

const client = { fake: 'client' };
jest.mock('../lib/supabase', () => ({ getSupabase: () => client }));
jest.mock('@finalmeal/api', () => ({
  ...jest.requireActual('@finalmeal/api'),
  getPicksInView: jest.fn(),
  getDishesInView: jest.fn(),
  nearestCity: jest.fn(),
}));
const mockPicks = jest.mocked(getPicksInView);
const mockDishes = jest.mocked(getDishesInView);
const mockCity = jest.mocked(nearestCity);

const HOME = { lat: 49.2827, lng: -123.1207 };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle(ms = 0) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Mounts the hook and lets its first load (from the home point) finish. */
async function mount(home: typeof HOME | null = HOME) {
  const view = await renderHook(() => useDiscover(home));
  await settle();
  return view;
}

function region(lng: number) {
  return {
    ...VANCOUVER_REGION,
    bounds: { ...VANCOUVER_REGION.bounds, west: lng - 0.1, east: lng + 0.1 },
    center: { lat: 49.275, lng },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPicks.mockResolvedValue({ places: makeDiscoverPlaces(), truncated: false });
  mockDishes.mockResolvedValue(makeDiscoverDishes());
  mockCity.mockResolvedValue({ id: 'c1', name: 'Vancouver' } as never);
});
afterEach(() => jest.useRealTimers());

describe('useDiscover', () => {
  it('loads at once from the home city, so the sheet works before the map reports', async () => {
    const { result } = await mount();
    expect(mockPicks).toHaveBeenCalledTimes(1);
    expect(mockDishes).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ west: expect.any(Number) }),
      DEFAULT_DISCOVER_FILTERS,
      HOME,
      { limit: 20 },
    );
    expect(result.current.status).toBe('ready');
    expect(result.current.places).toHaveLength(3);
    expect(result.current.dishes).toHaveLength(3);
    expect(result.current.cityName).toBe('Vancouver');
  });

  it('loads the world view with no home city', async () => {
    await mount(null);
    const bounds = mockPicks.mock.calls[0]![1];
    expect(bounds.west).toBe(-180);
    expect(bounds.east).toBe(180);
  });

  it('turns two region changes 100 ms apart into one load', async () => {
    const { result } = await mount();
    mockPicks.mockClear();
    mockDishes.mockClear();
    await act(async () => {
      result.current.onRegionChange(region(-123.1));
    });
    await settle(100);
    await act(async () => {
      result.current.onRegionChange(region(-122.9));
    });
    await settle(249);
    expect(mockPicks).not.toHaveBeenCalled();
    await settle(1);
    expect(mockPicks).toHaveBeenCalledTimes(1);
    expect(mockDishes).toHaveBeenCalledTimes(1);
    expect(mockPicks).toHaveBeenCalledWith(
      client,
      region(-122.9).bounds,
      DEFAULT_DISCOVER_FILTERS,
      region(-122.9).center,
    );
    expect(mockDishes.mock.calls[0]![3]).toEqual(region(-122.9).center);
  });

  it('drops a slow first response that arrives after the second, pins and sheet together', async () => {
    const { result } = await mount();
    const slowPicks = deferred<Awaited<ReturnType<typeof getPicksInView>>>();
    const slowDishes = deferred<Awaited<ReturnType<typeof getDishesInView>>>();
    mockPicks.mockReturnValueOnce(slowPicks.promise);
    mockDishes.mockReturnValueOnce(slowDishes.promise);
    await act(async () => {
      result.current.onRegionChange(region(-122.0));
    });
    await settle(250);
    const fresh = makeDiscoverPlaces().slice(0, 1);
    mockPicks.mockResolvedValueOnce({ places: fresh, truncated: true });
    mockDishes.mockResolvedValueOnce(makeDiscoverDishes().slice(0, 1));
    await act(async () => {
      result.current.onRegionChange(region(-121.0));
    });
    await settle(250);
    expect(result.current.places).toEqual(fresh);
    expect(result.current.dishes).toHaveLength(1);
    expect(result.current.truncated).toBe(true);
    await act(async () => {
      slowPicks.resolve({ places: makeDiscoverPlaces(), truncated: false });
      slowDishes.resolve(makeDiscoverDishes());
    });
    expect(result.current.places).toEqual(fresh);
    expect(result.current.dishes).toHaveLength(1);
    expect(result.current.truncated).toBe(true);
  });

  it('reloads a filter change at once and clears the selection', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.onRegionChange(VANCOUVER_REGION);
    });
    await settle(250);
    mockDishes.mockResolvedValueOnce(makeKinKaoSelection());
    await act(async () => {
      result.current.select('pl-kinkao');
    });
    await settle();
    expect(result.current.selectedId).toBe('pl-kinkao');
    expect(result.current.selected).toHaveLength(1);
    mockPicks.mockClear();
    const next = { ...DEFAULT_DISCOVER_FILTERS, tier: 'final' as const };
    await act(async () => {
      result.current.setFilters(next);
    });
    expect(mockPicks).toHaveBeenCalledTimes(1);
    expect(mockPicks).toHaveBeenCalledWith(client, VANCOUVER_REGION.bounds, next, VANCOUVER_REGION.center);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selected).toBeNull();
    expect(result.current.filters).toEqual(next);
    await settle();
  });

  it('loads the place’s dishes on select, drops a stale selection and clears on null', async () => {
    const { result } = await mount();
    const slow = deferred<Awaited<ReturnType<typeof getDishesInView>>>();
    mockDishes.mockReturnValueOnce(slow.promise);
    await act(async () => {
      result.current.select('pl-marutama');
    });
    mockDishes.mockResolvedValueOnce(makeKinKaoSelection());
    await act(async () => {
      result.current.select('pl-kinkao');
    });
    await settle();
    expect(mockDishes).toHaveBeenLastCalledWith(client, null, DEFAULT_DISCOVER_FILTERS, HOME, {
      placeId: 'pl-kinkao',
    });
    await act(async () => slow.resolve(makeDiscoverDishes().slice(0, 1)));
    expect(result.current.selected?.[0]?.dishName).toBe('Khao Soi');
    await act(async () => {
      result.current.select(null);
    });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selected).toBeNull();
  });

  it('shows the friendly copy on a failure and recovers on retry', async () => {
    mockPicks.mockRejectedValueOnce(new ApiError('x', 'network'));
    const { result } = await mount();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Can’t reach the kitchen right now.');
    await act(async () => result.current.retry());
    await settle();
    expect(result.current.status).toBe('ready');
    expect(result.current.error).toBeNull();
    expect(result.current.places).toHaveLength(3);
  });

  it('caches the city by the centre rounded to two decimals', async () => {
    const { result } = await mount();
    mockCity.mockClear();
    const moveTo = async (lat: number, lng: number) => {
      await act(async () => {
        result.current.onRegionChange({ ...VANCOUVER_REGION, center: { lat, lng } });
      });
      await settle(250);
    };
    // The start (49.28, -123.12) is already known.
    await moveTo(49.2801, -123.1201);
    expect(mockCity).not.toHaveBeenCalled();
    await moveTo(49.3, -123.1);
    expect(mockCity).toHaveBeenCalledTimes(1);
    await moveTo(49.3003, -123.1004);
    expect(mockCity).toHaveBeenCalledTimes(1);
    await moveTo(35.68, 139.69);
    expect(mockCity).toHaveBeenCalledTimes(2);
  });

  it('retries the view load, not a stale selection, after a view error', async () => {
    mockPicks.mockRejectedValueOnce(new ApiError('x', 'network'));
    const { result } = await mount();
    expect(result.current.status).toBe('error');
    await act(async () => {
      result.current.select('pl-kinkao');
    });
    await settle();
    await act(async () => {
      result.current.select(null);
    });
    expect(result.current.status).toBe('error');
    mockPicks.mockClear();
    await act(async () => result.current.retry());
    await settle();
    expect(mockPicks).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
    expect(result.current.places).toHaveLength(3);
  });

  it('retries a failed selection', async () => {
    const { result } = await mount();
    mockDishes.mockRejectedValueOnce(new ApiError('x', 'network'));
    await act(async () => {
      result.current.select('pl-kinkao');
    });
    await settle();
    expect(result.current.status).toBe('error');
    mockDishes.mockResolvedValueOnce(makeKinKaoSelection());
    await act(async () => result.current.retry());
    await settle();
    expect(result.current.status).toBe('ready');
    expect(result.current.selected).toHaveLength(1);
  });

  it('loads the map’s first real view even when it matches the synthesised start, then skips padding-only changes', async () => {
    const { result } = await mount();
    mockPicks.mockClear();
    const same = { ...region(-123.1), center: { lat: HOME.lat, lng: HOME.lng }, zoom: 12 };
    await act(async () => {
      result.current.onRegionChange(same);
    });
    await settle(250);
    expect(mockPicks).toHaveBeenCalledTimes(1);
    await act(async () => {
      result.current.onRegionChange({ ...same, bounds: region(-123.2).bounds });
    });
    await settle(250);
    expect(mockPicks).toHaveBeenCalledTimes(1);
    await act(async () => {
      result.current.onRegionChange({ ...same, zoom: 13 });
    });
    await settle(250);
    expect(mockPicks).toHaveBeenCalledTimes(2);
  });

  it('keeps a view failure when a selection fails and is then cleared', async () => {
    mockPicks.mockRejectedValueOnce(new ApiError('x', 'network'));
    const { result } = await mount();
    expect(result.current.status).toBe('error');
    mockDishes.mockRejectedValueOnce(new ApiError('x', 'network'));
    await act(async () => {
      result.current.select('pl-kinkao');
    });
    await settle();
    await act(async () => {
      result.current.select(null);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Can’t reach the kitchen right now.');
    mockPicks.mockClear();
    await act(async () => result.current.retry());
    await settle();
    expect(mockPicks).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ready');
  });

  it('falls back to the view failure when a selection retry succeeds', async () => {
    mockPicks.mockRejectedValueOnce(new ApiError('x', 'network'));
    const { result } = await mount();
    mockDishes.mockRejectedValueOnce(new ApiError('x', 'network'));
    await act(async () => {
      result.current.select('pl-kinkao');
    });
    await settle();
    mockDishes.mockResolvedValueOnce(makeKinKaoSelection());
    await act(async () => result.current.retry());
    await settle();
    expect(result.current.selected).toHaveLength(1);
    expect(result.current.status).toBe('error');
  });

  it('names no city below zoom 9, and does not ask for one', async () => {
    const { result } = await mount();
    mockCity.mockClear();
    await act(async () => {
      result.current.onRegionChange({ ...VANCOUVER_REGION, center: { lat: 10, lng: 10 }, zoom: 6 });
    });
    await settle(250);
    expect(result.current.cityName).toBeNull();
    expect(mockCity).not.toHaveBeenCalled();
  });

  it('shows pins and cards without waiting for the city, and never pairs a label with another view', async () => {
    const { result } = await mount();
    const slow = deferred<{ id: string; name: string }>();
    mockCity.mockReturnValueOnce(slow.promise as never);
    const fresh = makeDiscoverPlaces().slice(0, 1);
    mockPicks.mockResolvedValueOnce({ places: fresh, truncated: false });
    await act(async () => {
      result.current.onRegionChange({ ...VANCOUVER_REGION, center: { lat: 35.68, lng: 139.69 } });
    });
    await settle(250);
    expect(result.current.places).toEqual(fresh);
    // The previous name stays while the lookup runs, so the title does not flicker on every pan.
    expect(result.current.cityName).toBe('Vancouver');
    await act(async () => slow.resolve({ id: 'c2', name: 'Tokyo' }));
    expect(result.current.cityName).toBe('Tokyo');
  });

  it('drops a city that arrives for an older view', async () => {
    const { result } = await mount();
    const slow = deferred<{ id: string; name: string }>();
    mockCity.mockReturnValueOnce(slow.promise as never);
    await act(async () => {
      result.current.onRegionChange({ ...VANCOUVER_REGION, center: { lat: 35.68, lng: 139.69 } });
    });
    await settle(250);
    await act(async () => {
      result.current.onRegionChange({ ...VANCOUVER_REGION, center: { lat: 10, lng: 10 }, zoom: 5 });
    });
    await settle(250);
    await act(async () => slow.resolve({ id: 'c2', name: 'Tokyo' }));
    // Zoomed out too far to name a city: the stale Tokyo answer must not come back.
    expect(result.current.cityName).toBeNull();
  });

  it('never lets a stale lookup overwrite a newer one while the old name stays', async () => {
    const { result } = await mount();
    const first = deferred<{ id: string; name: string }>();
    const second = deferred<{ id: string; name: string }>();
    mockCity.mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    await act(async () => {
      result.current.onRegionChange({ ...VANCOUVER_REGION, center: { lat: 35.68, lng: 139.69 } });
    });
    await settle(250);
    await act(async () => {
      result.current.onRegionChange({ ...VANCOUVER_REGION, center: { lat: 34.69, lng: 135.5 } });
    });
    await settle(250);
    expect(result.current.cityName).toBe('Vancouver');
    await act(async () => second.resolve({ id: 'c3', name: 'Osaka' }));
    expect(result.current.cityName).toBe('Osaka');
    await act(async () => first.resolve({ id: 'c2', name: 'Tokyo' }));
    expect(result.current.cityName).toBe('Osaka');
  });

  it('measures a selection from the point it is given, and clears one with no dishes', async () => {
    const { result } = await mount();
    await act(async () => {
      result.current.select('pl-kinkao', { lat: 1, lng: 2 });
    });
    await settle();
    expect(mockDishes).toHaveBeenLastCalledWith(client, null, DEFAULT_DISCOVER_FILTERS, { lat: 1, lng: 2 }, {
      placeId: 'pl-kinkao',
    });
    mockDishes.mockResolvedValueOnce([]);
    await act(async () => {
      result.current.select('pl-skewers');
    });
    await settle();
    expect(result.current.selectedId).toBeNull();
  });
});
