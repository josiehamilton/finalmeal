import { beforeAll, describe, expect, it } from 'vitest';
import {
  ApiError,
  addPick,
  createCustomPlace,
  createMyProfile,
  followUser,
  getFollowingFeed,
  getMyNotificationSettings,
  getMyNotifications,
  getMyProfile,
  getMySaves,
  getNearbyFeed,
  getPickDetail,
  getPlacePickers,
  getProfile,
  getProfilePicks,
  getSuggestedPeople,
  getUnreadCount,
  listFollowers,
  listFollowing,
  markNotificationsRead,
  registerPushToken,
  respondToFollowRequest,
  saveDish,
  searchCities,
  searchPeople,
  setMyHomeCity,
  subscribeToMyNotifications,
  unfollowUser,
  unregisterPushToken,
  unsaveDish,
  updateMyNotificationSettings,
  updateMyProfile,
} from './index';
import type { FinalMealClient, FeedItem } from './index';
import { newTestClient, randomSuffix, signUpFreshUser } from './test-support/env';

async function newPerson(
  opts: { home?: boolean; isPrivate?: boolean } = {},
): Promise<{ client: FinalMealClient; id: string; username: string }> {
  const client = newTestClient();
  await signUpFreshUser(client);
  const username = `sx_${randomSuffix()}`;
  await createMyProfile(client, { displayName: 'Social Tester', username });
  if (opts.home !== false) {
    const vancouver = (await searchCities(client, 'vancouver')).find((c) => c.country === 'CA')!;
    await setMyHomeCity(client, vancouver.id);
  }
  if (opts.isPrivate) await updateMyProfile(client, { visibility: 'private' });
  const id = (await getMyProfile(client))!.id;
  return { client, id, username };
}

async function idOf(client: FinalMealClient, username: string): Promise<string> {
  const found = (await searchPeople(client, username)).find((p) => p.username === username);
  if (!found) throw new Error(`seed person ${username} not found`);
  return found.id;
}

async function pageAll(client: FinalMealClient, limit: number): Promise<FeedItem[]> {
  const all: FeedItem[] = [];
  let cursor = undefined as Awaited<ReturnType<typeof getFollowingFeed>>['next'] | undefined;
  for (let i = 0; i < 20; i++) {
    const page = await getFollowingFeed(client, cursor ?? undefined, limit);
    all.push(...page.items);
    if (!page.next) return all;
    cursor = page.next;
  }
  throw new Error('the Following feed never ended');
}

describe('people, follows and feeds (local Supabase)', () => {
  let me: Awaited<ReturnType<typeof newPerson>>;
  let ariId: string;
  let priyaId: string;

  beforeAll(async () => {
    me = await newPerson();
    ariId = await idOf(me.client, 'arimitchell');
    priyaId = await idOf(me.client, 'priyashah');
  });

  it('follows a public account straight away and shows it on their profile', async () => {
    expect(await followUser(me.client, ariId)).toBe('active');
    expect(await followUser(me.client, ariId)).toBe('active');
    const ari = (await getProfile(me.client, ariId))!;
    expect(ari).toMatchObject({
      username: 'arimitchell',
      displayName: 'Ari Mitchell',
      viewerFollow: 'active',
      canSeePicks: true,
      isMe: false,
      visibility: 'public',
    });
    expect(ari.bio).not.toBeNull();
    expect(ari.counts.dishes).toBeGreaterThan(0);
    expect(ari.counts.followers).toBeGreaterThanOrEqual(1);
    expect((await getMyProfile(me.client))!.counts.following).toBe(1);
    expect(await getProfile(me.client, '00000000-0000-4000-8000-0000000000ff')).toBeNull();
  });

  it('asks to follow a private account, which shows only the header', async () => {
    expect(await followUser(me.client, priyaId)).toBe('requested');
    const priya = (await getProfile(me.client, priyaId))!;
    expect(priya).toMatchObject({
      username: 'priyashah',
      viewerFollow: 'requested',
      canSeePicks: false,
      bio: null,
      homeCity: null,
      visibility: 'private',
    });
    expect(priya.counts.dishes).toBeNull();
    // A pending request is not a following: it is not counted.
    expect((await getMyProfile(me.client))!.counts.following).toBe(1);
    await unfollowUser(me.client, priyaId);
    expect((await getProfile(me.client, priyaId))!.viewerFollow).toBe('none');
  });

  it('starts the Following feed with Ari’s swap and pages without repeats', async () => {
    const first = await getFollowingFeed(me.client);
    expect(first.items[0]).toMatchObject({
      kind: 'dethroned',
      otherDishName: 'Tacos Al Pastor',
      savedByMe: false,
    });
    expect(first.items[0]!.actor.username).toBe('arimitchell');
    expect(first.items[0]!.pick.dish.name).toBe('Smash Burger');
    expect(first.items[0]!.pick.originalDishName).toBe('Smash Burger');
    expect(first.items[0]!.pick.place.lat).toBeGreaterThan(-90);
    expect(first.items[0]!.pick.place.lat).toBeLessThan(90);
    expect(first.items[0]!.pick.tags.every((t) => t.kind !== 'personal')).toBe(true);

    const one = await getFollowingFeed(me.client, undefined, 1);
    expect(one.items).toHaveLength(1);
    expect(one.next).not.toBeNull();
    const all = await pageAll(me.client, 1);
    const keys = all.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(all.length).toBeGreaterThanOrEqual(3);
    expect(all[0]!.key).toBe(first.items[0]!.key);
    // The swap shows once: Smash Burger is not also listed as an "added" card.
    expect(all.filter((i) => i.pick.dish.name === 'Smash Burger')).toHaveLength(1);
    expect(all.map((i) => i.key)).toEqual((await pageAll(me.client, 50)).map((i) => i.key));
  });

  it('gives a home-city person a Nearby feed, and a person without one an empty feed', async () => {
    const nearby = await getNearbyFeed(me.client);
    expect(nearby.items.length).toBeGreaterThan(0);
    expect(nearby.items.every((i) => i.actor.id !== me.id)).toBe(true);

    const noCity = await newPerson({ home: false });
    expect(await getNearbyFeed(noCity.client)).toEqual({ items: [], nextOffset: null });
  });

  it('saves a dish once, shows it in Saved and unsaves it', async () => {
    const item = (await getFollowingFeed(me.client)).items[0]!;
    await saveDish(me.client, item.pick.dish.id, item.pick.id);
    await saveDish(me.client, item.pick.dish.id, item.pick.id);
    const saves = await getMySaves(me.client);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({
      dish: { id: item.pick.dish.id, name: 'Smash Burger' },
      via: { username: 'arimitchell', displayName: 'arimitchell', avatarUrl: null },
      viaPickId: item.pick.id,
      viaTier: 'final',
    });
    expect(saves[0]!.distanceM).toEqual(expect.any(Number));
    expect((await getPickDetail(me.client, item.pick.id))!.savedByMe).toBe(true);

    await unsaveDish(me.client, item.pick.dish.id);
    expect(await getMySaves(me.client)).toEqual([]);
    await expect(saveDish(me.client, '00000000-0000-4000-8000-0000000000ff')).rejects.toMatchObject(
      { code: 'dish_not_found' },
    );
  });

  it('shows a public pick’s detail, and who else picked the dish', async () => {
    const item = (await getFollowingFeed(me.client)).items[0]!;
    const detail = (await getPickDetail(me.client, item.pick.id))!;
    expect(detail).toMatchObject({ isMine: false, owner: { username: 'arimitchell' } });
    expect(detail.pick.id).toBe(item.pick.id);
    expect(detail.finalCount).toBeGreaterThanOrEqual(1);
    expect(detail.listCount).toBeGreaterThanOrEqual(detail.finalCount);
    expect(detail.pickers.map((p) => p.username)).toContain('arimitchell');
    expect(await getPickDetail(me.client, '00000000-0000-4000-8000-0000000000ff')).toBeNull();

    const pickers = await getPlacePickers(me.client, item.pick.place.id);
    expect(pickers.otherCount).toBeGreaterThanOrEqual(1);
    expect(pickers.people.map((p) => p.username)).toContain('arimitchell');
  });

  it('reads another person’s picks with global tags only', async () => {
    const picks = await getProfilePicks(me.client, ariId);
    expect(picks[0]).toMatchObject({ tier: 'final', slot: 1 });
    expect(picks.map((p) => p.dish.name)).toContain('Pork Gyro');
    expect(picks.every((p) => p.tags.every((t) => t.kind !== 'personal'))).toBe(true);
  });

  it('returns no picks for a private account the viewer does not follow', async () => {
    expect(await getProfilePicks(me.client, priyaId)).toEqual([]);
    expect((await getProfilePicks(me.client, ariId)).length).toBeGreaterThan(0);
  });

  it('lists followers and following, finds people and suggests some', async () => {
    const following = await listFollowing(me.client, me.id);
    expect(following.map((p) => p.username)).toEqual(['arimitchell']);
    expect(following[0]).toMatchObject({ viewerFollow: 'active', isMe: false });
    const followers = await listFollowers(me.client, ariId, { q: me.username.slice(0, 7) });
    expect(followers.map((p) => p.id)).toContain(me.id);
    expect(followers.find((p) => p.id === me.id)!.isMe).toBe(true);
    expect(await listFollowers(me.client, ariId, { q: 'zzzznomatch' })).toEqual([]);

    const found = await searchPeople(me.client, 'arimit');
    expect(found[0]).toMatchObject({ username: 'arimitchell', viewerFollow: 'active' });
    expect(await searchPeople(me.client, '   ')).toEqual([]);

    const suggested = await getSuggestedPeople(me.client, 5);
    expect(suggested.length).toBeGreaterThan(0);
    expect(suggested.some((p) => p.username === 'arimitchell')).toBe(false);
    expect(suggested.some((p) => p.username === 'priyashah')).toBe(false);
    expect(suggested.some((p) => p.topDish !== null)).toBe(true);
  });
});

describe('add_pick duplicates (local Supabase)', () => {
  it('names the existing pick on the error', async () => {
    const { client } = await newPerson();
    const vancouver = (await searchCities(client, 'vancouver')).find((c) => c.country === 'CA')!;
    const place = await createCustomPlace(client, {
      name: `Dup Kitchen ${randomSuffix()}`,
      cityId: vancouver.id,
      address: '2 Test St, Vancouver, BC',
    });
    const first = await addPick(client, {
      placeId: place.id,
      dishName: 'Ramen',
      tier: 'honorable',
    });
    const error = await addPick(client, {
      placeId: place.id,
      dishName: 'ramen',
      tier: 'final',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'duplicate_pick',
      existingPick: { id: first.pick.id, tier: 'honorable' },
    });
  });
});

describe('follow requests and notifications (local Supabase)', () => {
  it('approves a request, notifies, and marks everything read', async () => {
    const owner = await newPerson({ isPrivate: true });
    const fan = await newPerson();

    expect(await followUser(fan.client, owner.id)).toBe('requested');
    expect((await getProfile(fan.client, owner.id))!.canSeePicks).toBe(false);

    expect(await getUnreadCount(owner.client)).toBe(1);
    const [asked] = await getMyNotifications(owner.client);
    expect(asked).toMatchObject({
      type: 'follow_requested',
      requestPending: true,
      readAt: null,
      viewerFollow: 'none',
      pickId: null,
      actor: { id: fan.id, username: fan.username },
    });

    await respondToFollowRequest(owner.client, fan.id, true);
    expect(await getProfile(fan.client, owner.id)).toMatchObject({
      viewerFollow: 'active',
      canSeePicks: true,
    });
    expect((await getMyNotifications(owner.client))[0]).toMatchObject({
      type: 'follow_requested',
      requestPending: false,
      viewerFollow: 'none',
    });
    const accepted = (await getMyNotifications(fan.client))[0]!;
    expect(accepted.type).toBe('follow_accepted');
    expect(accepted.actor.id).toBe(owner.id);

    await expect(respondToFollowRequest(owner.client, fan.id, true)).rejects.toMatchObject({
      code: 'request_not_found',
    });

    await markNotificationsRead(owner.client, [asked!.id]);
    expect(await getUnreadCount(owner.client)).toBe(0);
    expect((await getMyNotifications(owner.client))[0]!.readAt).not.toBeNull();

    // Fresh unread ones, cleared all at once.
    await unfollowUser(fan.client, owner.id);
    await followUser(fan.client, owner.id);
    expect(await getUnreadCount(owner.client)).toBe(1);
    await markNotificationsRead(owner.client);
    expect(await getUnreadCount(owner.client)).toBe(0);
    expect(await getUnreadCount(fan.client)).toBe(0);
  });

  it('shows a private account’s picks only after the owner approves', async () => {
    const owner = await newPerson({ isPrivate: true });
    const vancouver = (await searchCities(owner.client, 'vancouver')).find(
      (c) => c.country === 'CA',
    )!;
    const place = await createCustomPlace(owner.client, {
      name: `Private Kitchen ${randomSuffix()}`,
      cityId: vancouver.id,
      address: '3 Test St, Vancouver, BC',
    });
    await addPick(owner.client, { placeId: place.id, dishName: 'Secret Noodles', tier: 'final' });
    const fan = await newPerson();
    expect(await getProfilePicks(owner.client, owner.id)).toHaveLength(1);

    await followUser(fan.client, owner.id);
    expect(await getProfilePicks(fan.client, owner.id)).toEqual([]);
    await respondToFollowRequest(owner.client, fan.id, true);
    expect((await getProfilePicks(fan.client, owner.id)).map((p) => p.dish.name)).toEqual([
      'Secret Noodles',
    ]);
  });

  it('declines a request and drops it from the person’s list', async () => {
    const owner = await newPerson({ isPrivate: true });
    const fan = await newPerson();
    await followUser(fan.client, owner.id);
    await respondToFollowRequest(owner.client, fan.id, false);
    expect(await getMyNotifications(owner.client)).toEqual([]);
    expect((await getProfile(fan.client, owner.id))!.viewerFollow).toBe('none');
  });

  it('tells a subscriber when a notification arrives', async () => {
    const owner = await newPerson();
    const fan = await newPerson();
    let calls = 0;
    const unsubscribe = subscribeToMyNotifications(owner.client, owner.id, () => {
      calls += 1;
    });
    try {
      // The channel joins in the background: wait for it, so one follow is enough.
      const joinedBy = Date.now() + 10_000;
      while (
        !owner.client.getChannels().some((c) => c.state === 'joined') &&
        Date.now() < joinedBy
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      // Joined is a moment before the database stream is ready, so allow a second try.
      for (let attempt = 0; attempt < 3 && calls === 0; attempt++) {
        await followUser(fan.client, owner.id);
        const heardBy = Date.now() + 4000;
        while (calls === 0 && Date.now() < heardBy) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        await unfollowUser(fan.client, owner.id);
      }
      expect(calls).toBeGreaterThanOrEqual(1);
    } finally {
      unsubscribe();
    }
  });
});

describe('push tokens and notification settings (local Supabase)', () => {
  it('registers and unregisters a token, and refuses a bad one', async () => {
    const { client } = await newPerson();
    const token = `ExponentPushToken[sx${randomSuffix()}]`;
    await expect(registerPushToken(client, token, 'ios')).resolves.toBeUndefined();
    await expect(registerPushToken(client, token, 'android')).resolves.toBeUndefined();
    await expect(registerPushToken(client, 'not-a-token', 'ios')).rejects.toMatchObject({
      code: 'invalid_push_token',
    });
    await expect(unregisterPushToken(client, token)).resolves.toBeUndefined();
  });

  it('round-trips the notification settings', async () => {
    const { client } = await newPerson();
    expect(await getMyNotificationSettings(client)).toEqual({
      dethroned: true,
      newFollowers: true,
      saves: true,
      friendsFinals: true,
    });
    expect(await updateMyNotificationSettings(client, { saves: false })).toEqual({
      dethroned: true,
      newFollowers: true,
      saves: false,
      friendsFinals: true,
    });
    expect((await getMyNotificationSettings(client)).saves).toBe(false);
    expect(await updateMyNotificationSettings(client, {})).toMatchObject({ saves: false });
  });
});
