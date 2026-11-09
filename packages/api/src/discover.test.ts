import { DEFAULT_DISCOVER_FILTERS } from '@finalmeal/core';
import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';
import { getDishesInView, getPicksInView, normalizeBounds, searchDishes } from './discover';
import { fakeClient } from './test-support/fake-client';

const BOUNDS = { west: -123.3, south: 49.1, east: -122.9, north: 49.4 };
const CENTER = { lat: 49.28, lng: -123.12 };

const PLACE_JSON = {
  id: 'pl1',
  source: 'custom',
  name: 'Lotus Noodle Bar',
  area: 'Chinatown',
  address: null,
  city: 'Vancouver',
  region: 'BC',
  country: 'CA',
  location: { type: 'Point', coordinates: [-123.1003, 49.2794] },
  location_precision: 'exact',
};

const DISH_ROW = {
  dish_id: 'd1',
  dish_name: 'Xiao Long Bao',
  place: PLACE_JSON,
  best_tier: 'final',
  final_count: 1,
  honorable_count: 2,
  list_count: 3,
  pick_id: null,
  photo_path: 'u1/p.jpg',
  distance_m: 1234.5,
  people: [{ id: 'u2', username: 'ari', display_name: 'Ari', avatar_path: 'u2/a.jpg' }],
};

describe('normalizeBounds', () => {
  it('leaves an ordinary box and an antimeridian box unchanged', () => {
    expect(normalizeBounds(BOUNDS)).toEqual(BOUNDS);
    const fiji = { west: 170, south: -20, east: -170, north: -10 };
    expect(normalizeBounds(fiji)).toEqual(fiji);
  });

  it('sends a world viewport as -180..180, never wrapped', () => {
    expect(normalizeBounds({ west: -250, south: -95, east: 250, north: 95 })).toEqual({
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    });
    expect(normalizeBounds({ west: -180, south: -60, east: 180, north: 60 }).west).toBe(-180);
  });

  it('wraps a box that reaches past the date line', () => {
    expect(normalizeBounds({ west: 170, south: 0, east: 190, north: 10 })).toEqual({
      west: 170,
      south: 0,
      east: -170,
      north: 10,
    });
  });
});

describe('getPicksInView', () => {
  it('maps filters to arguments: tier all omitted, empty tags omitted, radius in metres, centre sent', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await getPicksInView(client, BOUNDS, DEFAULT_DISCOVER_FILTERS, CENTER);
    expect(calls[0]!.name).toBe('picks_in_view');
    expect(calls[0]!.options).toEqual({ get: true });
    expect(calls[0]!.args).toEqual({
      p_west: -123.3,
      p_south: 49.1,
      p_east: -122.9,
      p_north: 49.4,
      p_tier: undefined,
      p_following_only: false,
      p_food_type_ids: undefined,
      p_dietary_ids: undefined,
      p_center_lat: 49.28,
      p_center_lng: -123.12,
      p_radius_m: undefined,
      p_limit: 300,
    });
  });

  it('sends a tier, tags and a radius when set', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await getPicksInView(
      client,
      BOUNDS,
      { tier: 'final', followingOnly: true, radiusKm: 25, foodTypeIds: ['f1'], dietaryIds: ['g1'] },
      CENTER,
    );
    expect(calls[0]!.args).toMatchObject({
      p_tier: 'final',
      p_following_only: true,
      p_food_type_ids: ['f1'],
      p_dietary_ids: ['g1'],
      p_radius_m: 25_000,
    });
  });

  it('passes an antimeridian box through unchanged', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await getPicksInView(
      client,
      { west: 170, south: -20, east: -170, north: -10 },
      DEFAULT_DISCOVER_FILTERS,
      CENTER,
    );
    expect(calls[0]!.args).toMatchObject({ p_west: 170, p_east: -170 });
  });

  it('maps rows to places and flags a full page as truncated', async () => {
    const row = {
      place_id: 'pl1',
      name: 'Marutama',
      area: 'Bidwell St',
      address: null,
      city: 'Vancouver',
      lat: 49.29,
      lng: -123.13,
      best_tier: 'honorable',
      pick_count: 2,
      list_count: 14,
      top_dish_name: 'Tonkotsu Ramen',
    };
    const one = fakeClient(() => ({ data: [row] }));
    const result = await getPicksInView(one.client, BOUNDS, DEFAULT_DISCOVER_FILTERS, CENTER);
    expect(result.truncated).toBe(false);
    expect(result.places[0]).toEqual({
      id: 'pl1',
      name: 'Marutama',
      label: 'Bidwell St · Vancouver',
      city: 'Vancouver',
      lat: 49.29,
      lng: -123.13,
      bestTier: 'honorable',
      pickCount: 2,
      listCount: 14,
      topDishName: 'Tonkotsu Ramen',
    });
    const full = fakeClient(() => ({ data: Array.from({ length: 300 }, () => row) }));
    expect(
      (await getPicksInView(full.client, BOUNDS, DEFAULT_DISCOVER_FILTERS, CENTER)).truncated,
    ).toBe(true);
  });

  it('throws an ApiError on a database error', async () => {
    const { client } = fakeClient(() => ({
      error: { message: 'bad', code: 'invalid_coordinates' },
    }));
    await expect(
      getPicksInView(client, BOUNDS, DEFAULT_DISCOVER_FILTERS, CENTER),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('getDishesInView', () => {
  it('maps a row: place, people with avatar URLs, photo URL', async () => {
    const { client, calls } = fakeClient(() => ({ data: [DISH_ROW] }));
    const [dish] = await getDishesInView(client, BOUNDS, DEFAULT_DISCOVER_FILTERS, CENTER);
    expect(calls[0]!.name).toBe('dishes_in_view');
    expect(calls[0]!.options).toEqual({ get: true });
    expect(dish).toMatchObject({
      dishId: 'd1',
      dishName: 'Xiao Long Bao',
      bestTier: 'final',
      finalCount: 1,
      honorableCount: 2,
      listCount: 3,
      pickId: null,
      photoUrl: expect.stringMatching(/^https:\/\/files\.test\/.+\/u1\/p\.jpg$/),
      distanceM: 1234.5,
    });
    expect(dish!.place).toMatchObject({ id: 'pl1', label: 'Chinatown · Vancouver', onMap: true });
    expect(dish!.people).toEqual([
      {
        id: 'u2',
        username: 'ari',
        displayName: 'Ari',
        avatarUrl: expect.stringMatching(/\/u2\/a\.jpg$/),
      },
    ]);
  });

  it('works without bounds for one place, and caps the limit at 50', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await getDishesInView(client, null, DEFAULT_DISCOVER_FILTERS, null, {
      placeId: 'pl1',
      limit: 500,
    });
    expect(calls[0]!.args).toMatchObject({
      p_west: undefined,
      p_north: undefined,
      p_center_lat: undefined,
      p_place_id: 'pl1',
      p_limit: 50,
    });
  });

  it('survives a null people array and a null photo', async () => {
    const { client } = fakeClient(() => ({
      data: [{ ...DISH_ROW, people: null, photo_path: null, distance_m: null }],
    }));
    const [dish] = await getDishesInView(client, BOUNDS, DEFAULT_DISCOVER_FILTERS, CENTER);
    expect(dish).toMatchObject({ people: [], photoUrl: null, distanceM: null });
  });
});

describe('searchDishes', () => {
  it('makes no call for a blank query', async () => {
    const { client, calls } = fakeClient(() => ({ data: [DISH_ROW] }));
    expect(await searchDishes(client, '  ')).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('trims the query, sends the point and caps the limit at 20', async () => {
    const { client, calls } = fakeClient(() => ({ data: [DISH_ROW] }));
    const dishes = await searchDishes(client, ' ramen ', CENTER, 99);
    expect(dishes).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'search_dishes',
      args: { p_q: 'ramen', p_lat: 49.28, p_lng: -123.12, p_limit: 20 },
      options: { get: true },
    });
  });

  it('sends no point when there is none', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await searchDishes(client, 'ramen');
    expect(calls[0]!.args).toMatchObject({ p_lat: undefined, p_lng: undefined });
  });
});
