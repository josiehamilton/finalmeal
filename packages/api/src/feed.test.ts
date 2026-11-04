import { describe, expect, it } from 'vitest';
import { getFollowingFeed, getNearbyFeed, getPlacePickers, toFeedItem } from './feed';
import { fakeClient } from './test-support/fake-client';

// A place row as PostgREST sends it inside a composite: location as GeoJSON.
const PLACE = {
  id: 'pl1',
  source: 'custom',
  name: 'Skewers',
  area: null,
  address: '1 Main St, Vancouver, BC',
  city: 'Vancouver',
  region: 'BC',
  country: 'CA',
  location: { type: 'Point', coordinates: [-123.1, 49.28] },
};

function feedRow(n: number, over: Record<string, unknown> = {}) {
  return {
    item_key: `k${n}`,
    kind: 'dethroned',
    at: `2026-11-03T12:00:0${n}.123456+00:00`,
    actor_id: 'a1',
    actor_username: 'arimitchell',
    actor_display_name: 'Ari Mitchell',
    actor_avatar_path: 'a1/avatar.jpg',
    pick_id: `p${n}`,
    tier: 'final' as const,
    slot: 1,
    note: 'Crunchy',
    photo_path: 'a1/pick.jpg',
    dish_id: 'd1',
    dish_name: 'Smash Burger',
    place: PLACE,
    tags: [
      { id: 't2', kind: 'dietary', name: 'Halal', slug: 'halal', is_featured: true },
      { id: 't1', kind: 'food_type', name: 'Burger', slug: 'burger', is_featured: false },
    ],
    other_dish_name: 'Tacos Al Pastor',
    list_count: 8,
    saved_by_me: true,
    ...over,
  };
}

describe('toFeedItem', () => {
  it('maps a feed row: avatar and photo URLs, global tags, the dish name as the original name', () => {
    const { client } = fakeClient(() => ({}));
    const item = toFeedItem(client, feedRow(1));
    expect(item).toMatchObject({
      key: 'k1',
      kind: 'dethroned',
      at: '2026-11-03T12:00:01.123456+00:00',
      actor: {
        id: 'a1',
        username: 'arimitchell',
        displayName: 'Ari Mitchell',
        avatarUrl: 'https://files.test/avatars/a1/avatar.jpg',
      },
      otherDishName: 'Tacos Al Pastor',
      listCount: 8,
      savedByMe: true,
    });
    expect(item.pick).toMatchObject({
      id: 'p1',
      tier: 'final',
      slot: 1,
      note: 'Crunchy',
      photoUrl: 'https://files.test/pick-photos/a1/pick.jpg',
      originalDishName: 'Smash Burger',
      dish: { id: 'd1', name: 'Smash Burger' },
      place: {
        id: 'pl1',
        name: 'Skewers',
        lat: 49.28,
        lng: -123.1,
        label: '1 Main St · Vancouver',
      },
    });
    expect(item.pick.tags.map((t) => t.name)).toEqual(['Burger', 'Halal']);
  });

  it('copes with no photo and no tags', () => {
    const { client } = fakeClient(() => ({}));
    const item = toFeedItem(
      client,
      feedRow(1, { photo_path: null, tags: [], other_dish_name: null }),
    );
    expect(item.pick.photoUrl).toBeNull();
    expect(item.pick.tags).toEqual([]);
    expect(item.otherDishName).toBeNull();
  });
});

describe('getFollowingFeed', () => {
  it('asks for a page and hands back a cursor from the last card when the page is full', async () => {
    const { client, calls } = fakeClient(() => ({ data: [feedRow(2), feedRow(1)] }));
    const page = await getFollowingFeed(client, undefined, 2);
    expect(page.items.map((i) => i.key)).toEqual(['k2', 'k1']);
    expect(page.next).toEqual({ before: '2026-11-03T12:00:01.123456+00:00', beforeKey: 'k1' });
    expect(calls[0]).toMatchObject({
      name: 'following_feed',
      args: { p_before: undefined, p_before_key: undefined, p_limit: 2 },
    });
  });

  it('sends the cursor back, and has no next page when fewer than the limit come back', async () => {
    const { client, calls } = fakeClient(() => ({ data: [feedRow(1)] }));
    const page = await getFollowingFeed(client, { before: 'T', beforeKey: 'K' }, 20);
    expect(page.next).toBeNull();
    expect(calls[0]!.args).toMatchObject({ p_before: 'T', p_before_key: 'K', p_limit: 20 });
  });

  it('caps the page at 50 so a short page is not mistaken for the end', async () => {
    const { client, calls } = fakeClient(() => ({ data: [feedRow(1)] }));
    await getFollowingFeed(client, undefined, 500);
    expect(calls[0]!.args).toMatchObject({ p_limit: 50 });
  });
});

describe('getNearbyFeed', () => {
  it('pages by offset and stops on a short page', async () => {
    const full = fakeClient(() => ({ data: [feedRow(1, { kind: 'added_final' }), feedRow(2)] }));
    expect(await getNearbyFeed(full.client, 40, 2)).toMatchObject({ nextOffset: 42 });
    expect(full.calls[0]).toMatchObject({
      name: 'nearby_feed',
      args: { p_offset: 40, p_limit: 2 },
    });
    const short = fakeClient(() => ({ data: [feedRow(1)] }));
    expect(await getNearbyFeed(short.client, 0, 20)).toMatchObject({ nextOffset: null });
    const empty = fakeClient(() => ({ data: [] }));
    expect(await getNearbyFeed(empty.client)).toEqual({ items: [], nextOffset: null });
  });
});

describe('getPlacePickers', () => {
  it('maps the count and the people', async () => {
    const { client } = fakeClient(() => ({
      data: [
        {
          other_count: 8,
          people: [{ id: 'u1', username: 'ari', display_name: 'Ari', avatar_path: null }],
        },
      ],
    }));
    expect(await getPlacePickers(client, 'pl1')).toEqual({
      otherCount: 8,
      people: [{ id: 'u1', username: 'ari', displayName: 'Ari', avatarUrl: null }],
    });
  });
});
