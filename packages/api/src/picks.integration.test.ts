import { beforeAll, describe, expect, it } from 'vitest';
import {
  addPick,
  createCustomPlace,
  createMyProfile,
  createPersonalTag,
  demotePick,
  getMyPicks,
  getPick,
  getPlace,
  getPopularPlaces,
  moveFinal,
  promotePick,
  removePick,
  searchCities,
  searchPlaces,
  searchTags,
  suggestDishes,
  updatePick,
} from './index';
import type { FinalMealClient, Place, Pick } from './index';
import { newTestClient, randomSuffix, signUpFreshUser } from './test-support/env';

// A real (1x1) JPEG; Storage only checks the declared type and size.
const TINY_JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  ),
  (c) => c.charCodeAt(0),
).buffer;

/** Starts with the JPEG marker so it passes the check, but is over the 4 MiB bucket limit. */
function oversizedJpeg(): ArrayBuffer {
  const bytes = new Uint8Array(5 * 1024 * 1024);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  return bytes.buffer;
}

const VANCOUVER_POINT = { lat: 49.2827, lng: -123.1207 };

async function newPerson(): Promise<{ client: FinalMealClient; cityId: string; place: Place }> {
  const client = newTestClient();
  await signUpFreshUser(client);
  const suffix = randomSuffix();
  await createMyProfile(client, { displayName: 'Pick Tester', username: `pk_${suffix}` });
  const vancouver = (await searchCities(client, 'vancouver')).find((c) => c.country === 'CA')!;
  const place = await createCustomPlace(client, {
    name: `Test Kitchen ${suffix}`,
    cityId: vancouver.id,
    address: '1 Test St, Vancouver, BC',
  });
  return { client, cityId: vancouver.id, place };
}

const finals = (picks: Pick[]) => picks.filter((p) => p.tier === 'final');
const finalSlots = (picks: Pick[]) => finals(picks).map((p) => p.slot);
const names = (picks: Pick[]) => picks.map((p) => p.dish.name);

/** Slots are exactly 1..n, in order. */
function expectContiguous(picks: Pick[]) {
  expect(finalSlots(picks)).toEqual(finals(picks).map((_, i) => i + 1));
}

describe('tags, places and dishes (local Supabase)', () => {
  let client: FinalMealClient;
  let cityId: string;

  beforeAll(async () => {
    ({ client, cityId } = await newPerson());
  });

  it('searches the tag vocabulary and the Popular list', async () => {
    const found = await searchTags(client, 'food_type', 'ram');
    expect(found[0]).toMatchObject({ kind: 'food_type', name: 'Ramen', slug: 'ramen' });
    const popular = await searchTags(client, 'dietary', '');
    expect(popular.length).toBeGreaterThan(3);
    expect(popular.every((t) => t.kind === 'dietary' && t.featured)).toBe(true);
    expect(await searchTags(client, 'personal', '')).toEqual([]);
  });

  it('creates a personal tag once, and rejects a name over 40 characters', async () => {
    const first = await createPersonalTag(client, 'Rainy day');
    const again = await createPersonalTag(client, '  rainy   DAY ');
    expect(again.id).toBe(first.id);
    expect(first).toMatchObject({ kind: 'personal', name: 'Rainy day', slug: 'rainy-day' });
    expect((await searchTags(client, 'personal', 'rain')).map((t) => t.id)).toEqual([first.id]);
    await expect(createPersonalTag(client, 'x'.repeat(41))).rejects.toMatchObject({
      code: 'invalid_tag_name',
    });
  });

  it('finds Marutama first for "maru" with the Vancouver point, and its dish for "tonk"', async () => {
    const places = await searchPlaces(client, 'maru', VANCOUVER_POINT);
    expect(places[0]).toMatchObject({
      name: 'Marutama',
      city: 'Vancouver',
      source: 'custom',
      label: 'Bidwell St · Vancouver',
    });
    expect(places[0]!.lat).toBeCloseTo(49.2905, 3);
    expect(places[0]!.lng).toBeCloseTo(-123.1366, 3);

    const dishes = await suggestDishes(client, places[0]!.id, 'tonk');
    expect(dishes[0]).toMatchObject({ name: 'Tonkotsu Ramen' });
    expect(dishes[0]!.pickCount).toBeGreaterThanOrEqual(1);
  });

  it('lists the most-picked spots in a city, and only that city', async () => {
    const vancouver = await getPopularPlaces(client, cityId, 12);
    expect(vancouver.slice(0, 3).map((p) => p.name)).toEqual(['Kin Kao', 'Marutama', 'Skewers']);
    expect(vancouver.every((p) => p.country === 'CA' && p.city !== 'Saskatoon')).toBe(true);
    expect(vancouver.some((p) => p.name === 'Sushi Itto')).toBe(false);
    expect(vancouver[0]!.lat).toBeCloseTo(49.262, 2);

    const tokyo = (await searchCities(client, 'tokyo'))[0]!;
    const inTokyo = await getPopularPlaces(client, tokyo.id, 12);
    expect(inTokyo.slice(0, 2).map((p) => p.name)).toEqual(['Sushi Itto', 'Sushi Dai']);
    expect(inTokyo.some((p) => p.city === 'Vancouver')).toBe(false);
  });

  it('adds a custom spot with an address, or a food truck without one', async () => {
    const suffix = randomSuffix();
    const withAddress = await createCustomPlace(client, {
      name: `Corner Cafe ${suffix}`,
      cityId,
      address: '12 Main St, Vancouver, BC',
    });
    expect(withAddress).toMatchObject({
      source: 'custom',
      city: 'Vancouver',
      address: '12 Main St, Vancouver, BC',
      label: '12 Main St · Vancouver',
    });
    const truck = await createCustomPlace(client, {
      name: `Taco Truck ${suffix}`,
      cityId,
      noFixedAddress: true,
    });
    expect(truck.address).toBeNull();
    expect(truck.label).toBe('Vancouver');

    expect(await getPlace(client, withAddress.id)).toEqual(withAddress);
    expect(await getPlace(client, '00000000-0000-4000-8000-00000000dead')).toBeNull();
    expect((await searchPlaces(client, `corner cafe ${suffix}`, VANCOUVER_POINT))[0]?.id).toBe(
      withAddress.id,
    );
  });

  it('maps place rejections to friendly codes', async () => {
    await expect(createCustomPlace(client, { name: 'No Address', cityId })).rejects.toMatchObject({
      code: 'address_required',
    });
    await expect(
      createCustomPlace(client, { name: 'Both', cityId, address: '1 A St', noFixedAddress: true }),
    ).rejects.toMatchObject({ code: 'address_required' });
    await expect(
      createCustomPlace(client, { name: '  ', cityId, address: '1 A St' }),
    ).rejects.toMatchObject({ code: 'invalid_place_name' });
    await expect(
      createCustomPlace(client, {
        name: 'Nowhere',
        cityId: '00000000-0000-4000-8000-00000000dead',
        address: '1 A St',
      }),
    ).rejects.toMatchObject({ code: 'city_not_found' });
  });
});

describe('a person building their Final Meal (local Supabase)', () => {
  let client: FinalMealClient;
  let place: Place;
  const dishes = ['Alpha Noodles', 'Bravo Rice', 'Charlie Soup', 'Delta Curry', 'Echo Tacos'];

  beforeAll(async () => {
    ({ client, place } = await newPerson());
  });

  it('starts with no picks', async () => {
    expect(await getMyPicks(client)).toEqual([]);
    expect(await getPick(client, '00000000-0000-4000-8000-00000000dead')).toBeNull();
  });

  it('adds five finals into slots 1..5, then rejects a sixth with final_full', async () => {
    for (const [i, dishName] of dishes.entries()) {
      const { pick, photoFailed } = await addPick(client, {
        placeId: place.id,
        dishName,
        tier: 'final',
      });
      expect(photoFailed).toBe(false);
      expect(pick).toMatchObject({ tier: 'final', slot: i + 1, originalDishName: dishName });
      expect(pick.place.id).toBe(place.id);
    }
    await expect(
      addPick(client, { placeId: place.id, dishName: 'Foxtrot Pie', tier: 'final' }),
    ).rejects.toMatchObject({ name: 'ApiError', code: 'final_full' });
    const picks = await getMyPicks(client);
    expect(names(picks)).toEqual(dishes);
    expectContiguous(picks);
  });

  it('swaps: the new pick takes the slot, the old one becomes the newest honorable', async () => {
    const { pick } = await addPick(client, {
      placeId: place.id,
      dishName: 'Foxtrot Pie',
      tier: 'final',
      replaceSlot: 2,
    });
    expect(pick).toMatchObject({ tier: 'final', slot: 2 });
    const picks = await getMyPicks(client);
    expect(names(picks)).toEqual([
      'Alpha Noodles',
      'Foxtrot Pie',
      'Charlie Soup',
      'Delta Curry',
      'Echo Tacos',
      'Bravo Rice',
    ]);
    expect(picks[5]).toMatchObject({ tier: 'honorable', slot: null });
    expectContiguous(picks);
  });

  it('rejects a swap into a slot that does not exist', async () => {
    for (const replaceSlot of [0, 6]) {
      await expect(
        addPick(client, { placeId: place.id, dishName: 'Golf Soup', tier: 'final', replaceSlot }),
      ).rejects.toMatchObject({ code: 'invalid_slot' });
    }
    expect((await getMyPicks(client)).length).toBe(6);
  });

  it('rejects the same dish typed differently, in either tier', async () => {
    for (const [dishName, tier] of [
      ['alpha noodles', 'honorable'],
      ['  ALPHA   Noodles!! ', 'final'],
      ['Bravo Rice', 'honorable'],
    ] as const) {
      await expect(addPick(client, { placeId: place.id, dishName, tier })).rejects.toMatchObject({
        code: 'duplicate_pick',
      });
    }
    expect((await getMyPicks(client)).length).toBe(6);
  });

  it('promotes an honorable into a swap, then demotes and removes keep slots contiguous', async () => {
    const before = await getMyPicks(client);
    const bravo = before.find((p) => p.dish.name === 'Bravo Rice')!;

    // Full five: promoting needs a slot to replace.
    await expect(promotePick(client, bravo.id)).rejects.toMatchObject({ code: 'final_full' });
    const promoted = await promotePick(client, bravo.id, 1);
    expect(promoted).toMatchObject({ tier: 'final', slot: 1 });
    let picks = await getMyPicks(client);
    expect(names(picks)).toEqual([
      'Bravo Rice',
      'Foxtrot Pie',
      'Charlie Soup',
      'Delta Curry',
      'Echo Tacos',
      'Alpha Noodles',
    ]);
    expectContiguous(picks);

    // Demote slot 2: slots 3-5 move up.
    const demoted = await demotePick(client, picks[1]!.id);
    expect(demoted).toMatchObject({ tier: 'honorable', slot: null });
    picks = await getMyPicks(client);
    expect(finals(picks).map((p) => [p.dish.name, p.slot])).toEqual([
      ['Bravo Rice', 1],
      ['Charlie Soup', 2],
      ['Delta Curry', 3],
      ['Echo Tacos', 4],
    ]);
    expectContiguous(picks);

    // Promote with room: takes the next slot, no swap needed.
    const back = await promotePick(client, demoted.id);
    expect(back).toMatchObject({ tier: 'final', slot: 5 });

    // Remove slot 1: the rest move up.
    await removePick(client, picks[0]!.id);
    picks = await getMyPicks(client);
    expect(finals(picks).map((p) => [p.dish.name, p.slot])).toEqual([
      ['Charlie Soup', 1],
      ['Delta Curry', 2],
      ['Echo Tacos', 3],
      ['Foxtrot Pie', 4],
    ]);
    expect(await getPick(client, bravo.id)).toBeNull();
    await expect(removePick(client, bravo.id)).rejects.toMatchObject({ code: 'pick_not_found' });
  });

  it('reorders the finals with moveFinal', async () => {
    const picks = await getMyPicks(client);
    const last = finals(picks).at(-1)!;
    const moved = await moveFinal(client, last.id, 1);
    expect(finals(moved).map((p) => p.dish.name)).toEqual([
      'Foxtrot Pie',
      'Charlie Soup',
      'Delta Curry',
      'Echo Tacos',
    ]);
    expectContiguous(moved);
    await expect(moveFinal(client, last.id, 9)).rejects.toMatchObject({ code: 'invalid_slot' });
    await expect(moveFinal(client, last.id, 0)).rejects.toMatchObject({ code: 'invalid_slot' });
  });

  it('puts the finals by slot first, then honorables newest first', async () => {
    const first = await addPick(client, {
      placeId: place.id,
      dishName: 'Hotel Salad',
      tier: 'honorable',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await addPick(client, {
      placeId: place.id,
      dishName: 'India Soup',
      tier: 'honorable',
    });
    const picks = await getMyPicks(client);
    const honorables = picks.filter((p) => p.tier === 'honorable');
    expect(honorables.slice(0, 2).map((p) => p.id)).toEqual([second.pick.id, first.pick.id]);
    expect(picks.findIndex((p) => p.tier === 'honorable')).toBe(finals(picks).length);
  });

  it('reads a pick with its place, wording and tags', async () => {
    const ramen = (await searchTags(client, 'food_type', 'ramen'))[0]!;
    const vegan = (await searchTags(client, 'dietary', 'vegan'))[0]!;
    const { pick } = await addPick(client, {
      placeId: place.id,
      dishName: 'juliet ramen (extra egg)',
      tier: 'honorable',
      note: '  Worth the queue.  ',
      tagIds: [ramen.id, vegan.id, ramen.id],
      personalTags: ['Date night', '  date   NIGHT '],
    });
    expect(pick).toMatchObject({
      note: 'Worth the queue.',
      originalDishName: 'juliet ramen (extra egg)',
    });
    expect(pick.tags.map((t) => [t.kind, t.name])).toEqual([
      ['food_type', 'Ramen'],
      ['dietary', 'Vegan'],
      ['personal', 'Date night'],
    ]);
    expect(await getPick(client, pick.id)).toEqual(pick);
    expect((await getMyPicks(client)).find((p) => p.id === pick.id)).toEqual(pick);
  });

  it('rejects bad input with friendly codes and changes nothing', async () => {
    const count = (await getMyPicks(client)).length;
    await expect(
      addPick(client, { placeId: place.id, dishName: '   ', tier: 'honorable' }),
    ).rejects.toMatchObject({ code: 'invalid_dish_name' });
    await expect(
      addPick(client, { placeId: place.id, dishName: 'x'.repeat(81), tier: 'honorable' }),
    ).rejects.toMatchObject({ code: 'invalid_dish_name' });
    await expect(
      addPick(client, {
        placeId: '00000000-0000-4000-8000-00000000dead',
        dishName: 'Kilo Pasta',
        tier: 'honorable',
      }),
    ).rejects.toMatchObject({ code: 'place_not_found' });
    await expect(
      addPick(client, {
        placeId: place.id,
        dishName: 'Kilo Pasta',
        tier: 'honorable',
        tagIds: ['00000000-0000-4000-8000-00000000dead'],
      }),
    ).rejects.toMatchObject({ code: 'invalid_tag' });
    await expect(
      addPick(client, {
        placeId: place.id,
        dishName: 'Kilo Pasta',
        tier: 'honorable',
        personalTags: ['x'.repeat(41)],
      }),
    ).rejects.toMatchObject({ code: 'invalid_tag_name' });
    // A note over 280 characters trips a table check; it surfaces as the generic failure.
    await expect(
      addPick(client, {
        placeId: place.id,
        dishName: 'Kilo Pasta',
        tier: 'honorable',
        note: 'n'.repeat(281),
      }),
    ).rejects.toMatchObject({ code: 'unknown' });
    expect((await getMyPicks(client)).length).toBe(count);
  });

  it('updates the note, tags and personal tags; a bad update changes nothing', async () => {
    const { pick } = await addPick(client, {
      placeId: place.id,
      dishName: 'Lima Bowl',
      tier: 'honorable',
      note: 'First note',
      personalTags: ['Spicy'],
    });
    const vegan = (await searchTags(client, 'dietary', 'vegan'))[0]!;

    const changed = await updatePick(client, pick.id, { note: 'Second note', tagIds: [vegan.id] });
    expect(changed.note).toBe('Second note');
    expect(changed.tags.map((t) => t.name)).toEqual(['Vegan', 'Spicy']); // personal tags kept

    const swapped = await updatePick(client, pick.id, { personalTags: ['Splurge'] });
    expect(swapped.tags.map((t) => t.name)).toEqual(['Vegan', 'Splurge']);
    expect(swapped.note).toBe('Second note');

    const cleared = await updatePick(client, pick.id, { note: null, tagIds: [], personalTags: [] });
    expect(cleared.note).toBeNull();
    expect(cleared.tags).toEqual([]);

    await expect(updatePick(client, pick.id, { note: 'n'.repeat(281) })).rejects.toMatchObject({
      code: 'unknown',
    });
    await expect(
      updatePick(client, pick.id, { tagIds: ['00000000-0000-4000-8000-00000000dead'] }),
    ).rejects.toMatchObject({ code: 'invalid_tag' });
    await expect(
      updatePick(client, '00000000-0000-4000-8000-00000000dead', { note: 'x' }),
    ).rejects.toMatchObject({ code: 'pick_not_found' });
    expect(await getPick(client, pick.id)).toEqual(cleared);
  });
});

describe('pick photos (local Supabase)', () => {
  let client: FinalMealClient;
  let place: Place;

  beforeAll(async () => {
    ({ client, place } = await newPerson());
  });

  it('uploads a photo with the pick and serves it', async () => {
    const { pick, photoFailed } = await addPick(client, {
      placeId: place.id,
      dishName: 'Photo Ramen',
      tier: 'final',
      photo: TINY_JPEG,
    });
    expect(photoFailed).toBe(false);
    expect(pick.photoUrl).toMatch(/\/storage\/v1\/object\/public\/pick-photos\/.+\/pick-\d+\.jpg$/);
    const res = await fetch(pick.photoUrl!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
  });

  it('saves the pick without a photo when the upload fails, and the photo can be added later', async () => {
    const { pick, photoFailed } = await addPick(client, {
      placeId: place.id,
      dishName: 'Oversize Ramen',
      tier: 'honorable',
      photo: oversizedJpeg(),
    });
    expect(photoFailed).toBe(true);
    expect(pick).toMatchObject({ photoUrl: null, tier: 'honorable' });
    expect(await getPick(client, pick.id)).toMatchObject({ id: pick.id, photoUrl: null });

    // A retry of the same dish is a duplicate, not a second pick.
    await expect(
      addPick(client, {
        placeId: place.id,
        dishName: 'Oversize Ramen',
        tier: 'honorable',
        photo: TINY_JPEG,
      }),
    ).rejects.toMatchObject({ code: 'duplicate_pick' });

    const withPhoto = await updatePick(client, pick.id, { photo: TINY_JPEG });
    expect(withPhoto.photoUrl).not.toBeNull();
    expect((await fetch(withPhoto.photoUrl!)).status).toBe(200);
  });

  it('does not leave a photo behind when the pick is refused', async () => {
    const before = (await getMyPicks(client)).filter((p) => p.photoUrl).length;
    await expect(
      addPick(client, {
        placeId: place.id,
        dishName: 'photo ramen',
        tier: 'honorable',
        photo: TINY_JPEG,
      }),
    ).rejects.toMatchObject({ code: 'duplicate_pick' });
    expect((await getMyPicks(client)).filter((p) => p.photoUrl).length).toBe(before);
  });

  it('rejects a file that is not a JPEG without a request', async () => {
    const before = (await getMyPicks(client)).length;
    await expect(
      addPick(client, {
        placeId: place.id,
        dishName: 'Not A Photo',
        tier: 'honorable',
        photo: new TextEncoder().encode('File not found').buffer as ArrayBuffer,
      }),
    ).rejects.toMatchObject({ code: 'invalid_photo' });
    expect((await getMyPicks(client)).length).toBe(before);
  });

  it('replaces and removes a photo, deleting the old file', async () => {
    const [pick] = (await getMyPicks(client)).filter((p) => p.dish.name === 'Photo Ramen');
    const oldUrl = pick!.photoUrl!;
    await new Promise((resolve) => setTimeout(resolve, 5)); // a different millisecond
    const replaced = await updatePick(client, pick!.id, { photo: TINY_JPEG });
    expect(replaced.photoUrl).not.toBe(oldUrl);
    expect((await fetch(replaced.photoUrl!)).status).toBe(200);
    expect((await fetch(oldUrl)).ok).toBe(false);

    const removed = await updatePick(client, pick!.id, { photo: null });
    expect(removed.photoUrl).toBeNull();
    expect((await fetch(replaced.photoUrl!)).ok).toBe(false);
  });

  it('deletes the photo file when the pick is removed', async () => {
    const { pick } = await addPick(client, {
      placeId: place.id,
      dishName: 'Short Lived',
      tier: 'honorable',
      photo: TINY_JPEG,
    });
    expect((await fetch(pick.photoUrl!)).status).toBe(200);
    await removePick(client, pick.id);
    expect((await fetch(pick.photoUrl!)).ok).toBe(false);
  });
});

/** Removes everything the person has picked, so each test below starts from nothing. */
async function clearPicks(client: FinalMealClient): Promise<void> {
  for (const pick of await getMyPicks(client)) await removePick(client, pick.id);
}

describe('one person acting twice at once (local Supabase)', () => {
  let client: FinalMealClient;
  let place: Place;
  let other: Awaited<ReturnType<typeof newPerson>>;

  beforeAll(async () => {
    ({ client, place } = await newPerson());
    other = await newPerson();
  });

  it('gives exactly one pick and one duplicate_pick for the same dish added concurrently', async () => {
    await clearPicks(client);
    const results = await Promise.allSettled([
      addPick(client, { placeId: place.id, dishName: 'Race Ramen', tier: 'final' }),
      addPick(client, { placeId: place.id, dishName: 'race  ramen!', tier: 'final' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: { name: 'ApiError', code: 'duplicate_pick' } });
    const picks = await getMyPicks(client);
    expect(picks).toHaveLength(1);
    expect(picks[0]).toMatchObject({ slot: 1 });
  });

  it('keeps the finals contiguous when adds, a remove and a demote happen at once', async () => {
    await clearPicks(client);
    const added = [];
    for (const dishName of ['One', 'Two', 'Three']) {
      added.push((await addPick(client, { placeId: place.id, dishName, tier: 'final' })).pick);
    }
    const results = await Promise.allSettled([
      addPick(client, { placeId: place.id, dishName: 'Four', tier: 'final' }),
      removePick(client, added[0]!.id),
      addPick(client, { placeId: place.id, dishName: 'Five', tier: 'final' }),
      demotePick(client, added[1]!.id),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const picks = await getMyPicks(client);
    expect(picks).toHaveLength(4); // One was removed
    expectContiguous(picks);
    expect(names(finals(picks)).sort()).toEqual(['Five', 'Four', 'Three']);
  });

  it('never goes past five finals when many adds race', async () => {
    await clearPicks(client);
    const results = await Promise.allSettled(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) =>
        addPick(client, { placeId: place.id, dishName: `Dish ${letter}`, tier: 'final' }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    for (const r of results.filter((r) => r.status === 'rejected')) {
      expect(r).toMatchObject({ reason: { code: 'final_full' } });
    }
    const picks = await getMyPicks(client);
    expect(picks).toHaveLength(5);
    expectContiguous(picks);
  });

  it('cannot be changed by another person', async () => {
    await clearPicks(client);
    const { pick } = await addPick(client, { placeId: place.id, dishName: 'Mine', tier: 'final' });

    // Anyone can read a pick; only its owner can change it.
    expect(await getPick(other.client, pick.id)).toMatchObject({ id: pick.id });
    await expect(removePick(other.client, pick.id)).rejects.toMatchObject({
      code: 'pick_not_found',
    });
    await expect(demotePick(other.client, pick.id)).rejects.toMatchObject({
      code: 'pick_not_found',
    });
    await expect(updatePick(other.client, pick.id, { note: 'hijack' })).rejects.toMatchObject({
      code: 'pick_not_found',
    });
    expect(await getPick(client, pick.id)).toMatchObject({ slot: 1, note: null });
    expect(await getMyPicks(other.client)).toEqual([]);
  });
});
