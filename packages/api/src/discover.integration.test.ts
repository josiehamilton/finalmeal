import { DEFAULT_DISCOVER_FILTERS } from '@finalmeal/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createMyProfile,
  getDishesInView,
  getPicksInView,
  searchCities,
  searchDishes,
  searchPeople,
  setMyHomeCity,
} from './index';
import type { FinalMealClient } from './index';
import { newTestClient, randomSuffix, signUpFreshUser } from './test-support/env';

const VANCOUVER = { lat: 49.2827, lng: -123.1207 };
const VANCOUVER_BOX = { west: -123.3, south: 49.1, east: -122.9, north: 49.4 };

describe('Discover (against the seeded local backend)', () => {
  let client: FinalMealClient;

  beforeAll(async () => {
    client = newTestClient();
    await signUpFreshUser(client);
    await createMyProfile(client, {
      displayName: 'Discover Tester',
      username: `dv_${randomSuffix()}`,
    });
    const vancouver = (await searchCities(client, 'vancouver')).find((c) => c.country === 'CA')!;
    await setMyHomeCity(client, vancouver.id);
  });

  it('pins the six Vancouver places for a brand-new account', async () => {
    const { places, truncated } = await getPicksInView(
      client,
      VANCOUVER_BOX,
      DEFAULT_DISCOVER_FILTERS,
      VANCOUVER,
    );
    expect(truncated).toBe(false);
    expect(places.map((p) => p.name).sort()).toEqual(
      ['Hearth Bakery', 'Kin Kao', 'Lotus Noodle Bar', 'Marutama', 'Miku', 'Skewers'].sort(),
    );
    expect(places.find((p) => p.name === 'Skewers')).toMatchObject({ bestTier: 'final' });
  });

  it('finds the whole globe from a world viewport', async () => {
    const { places } = await getPicksInView(
      client,
      { west: -400, south: -90, east: 400, north: 90 },
      DEFAULT_DISCOVER_FILTERS,
      { lat: 20, lng: 0 },
    );
    expect(places.length).toBeGreaterThan(6);
  });

  it('lists a place’s dishes, including one the viewer cannot open', async () => {
    const { places } = await getPicksInView(
      client,
      VANCOUVER_BOX,
      DEFAULT_DISCOVER_FILTERS,
      VANCOUVER,
    );
    const lotus = places.find((p) => p.name === 'Lotus Noodle Bar')!;
    const dishes = await getDishesInView(client, null, DEFAULT_DISCOVER_FILTERS, VANCOUVER, {
      placeId: lotus.id,
    });
    const xlb = dishes.find((d) => d.dishName === 'Xiao Long Bao');
    expect(xlb).toBeDefined();
    // Only a private account has picked it, so it counts but opens nothing and names no one.
    expect(xlb!.pickId).toBeNull();
    expect(xlb!.people).toEqual([]);
  });

  it('searches dishes by name, nearest first', async () => {
    const dishes = await searchDishes(client, 'ramen', VANCOUVER);
    expect(dishes[0]!.dishName).toBe('Tonkotsu Ramen');
    expect(await searchDishes(client, '   ')).toEqual([]);
  });

  it('returns a follower count with people search', async () => {
    // The seeded @allimercer ("Alli Mercer"), not a prefix like 'ali' that only matches whatever
    // other test files happen to have created at the time.
    const found = await searchPeople(client, 'alli');
    const alli = found.find((p) => p.username === 'allimercer');
    expect(alli).toBeDefined();
    expect(typeof alli!.followersCount).toBe('number');
  });
});
