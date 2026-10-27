import { describe, expect, it } from 'vitest';
import {
  createMyProfile,
  finishOnboarding,
  getMyProfile,
  isUsernameAvailable,
  nearestCity,
  searchCities,
  setMyHomeCity,
  updateMyProfile,
  uploadMyAvatar,
} from './index';
import { newTestClient, randomSuffix, signUpFreshUser } from './test-support/env';

// A real (1x1) JPEG; Storage only checks the declared type and size.
const TINY_JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  ),
  (c) => c.charCodeAt(0),
).buffer;

describe('a new person end to end (local Supabase)', () => {
  const client = newTestClient();
  const suffix = randomSuffix();
  const username = `np_${suffix}`;

  it('signs up with the email code and gets no profile yet', async () => {
    await signUpFreshUser(client, `  New.Person+${suffix}@Example.com `);
    expect(await getMyProfile(client)).toBeNull();
  });

  it('checks a handle, then creates the profile', async () => {
    expect(await isUsernameAvailable(client, username)).toBe(true);
    expect(await isUsernameAvailable(client, 'josiehamilton')).toBe(false);
    expect(await isUsernameAvailable(client, 'JosieHamilton')).toBe(false);
    expect(await isUsernameAvailable(client, 'no')).toBe(false);

    const profile = await createMyProfile(client, { displayName: 'New Person', username });
    expect(profile).toMatchObject({
      username,
      displayName: 'New Person',
      bio: null,
      avatarUrl: null,
      homeCity: null,
      showHomeCity: true,
      visibility: 'public',
      onboarded: false,
      counts: { followers: 0, following: 0, dishes: 0 },
    });
    // Your own handle still counts as available to you.
    expect(await isUsernameAvailable(client, username)).toBe(true);
    await expect(createMyProfile(client, { displayName: 'Again', username })).rejects.toMatchObject(
      {
        code: 'profile_exists',
      },
    );
  });

  it('finds Vancouver, BC and sets it as the home city', async () => {
    const results = await searchCities(client, 'vancouver');
    const vancouver = results.find((c) => c.country === 'CA');
    expect(vancouver).toMatchObject({ label: 'Vancouver, BC, Canada', regionCode: 'BC' });

    const nearest = await nearestCity(client, 49.28, -123.12);
    expect(nearest?.label).toBe('Vancouver, BC, Canada');

    const profile = await setMyHomeCity(client, vancouver!.id);
    expect(profile.homeCity).toEqual({ id: vancouver!.id, label: 'Vancouver, BC, Canada' });

    await expect(
      setMyHomeCity(client, '00000000-0000-4000-8000-00000000dead'),
    ).rejects.toMatchObject({ code: 'city_not_found' });

    const cleared = await setMyHomeCity(client, null);
    expect(cleared.homeCity).toBeNull();
    expect((await setMyHomeCity(client, vancouver!.id)).homeCity?.label).toBe(
      'Vancouver, BC, Canada',
    );
  });

  it('updates the editable fields and maps rejections to friendly codes', async () => {
    const updated = await updateMyProfile(client, {
      displayName: 'New P.',
      bio: '  Soup, mostly.  ',
      visibility: 'private',
      showHomeCity: false,
    });
    expect(updated).toMatchObject({
      displayName: 'New P.',
      bio: 'Soup, mostly.',
      visibility: 'private',
      showHomeCity: false,
    });
    expect((await updateMyProfile(client, { bio: '   ' })).bio).toBeNull();
    expect((await updateMyProfile(client, {})).displayName).toBe('New P.');

    const renamed = await updateMyProfile(client, { username: `${username}_2` });
    expect(renamed.username).toBe(`${username}_2`);

    await expect(updateMyProfile(client, { username: 'josiehamilton' })).rejects.toMatchObject({
      code: 'username_taken',
    });
    await expect(updateMyProfile(client, { username: 'bad name!' })).rejects.toMatchObject({
      code: 'invalid_username',
    });
    await expect(updateMyProfile(client, { bio: 'x'.repeat(101) })).rejects.toMatchObject({
      code: 'unknown',
    });
    await expect(updateMyProfile(client, { displayName: '' })).rejects.toMatchObject({
      code: 'unknown',
    });
  });

  it('finishes onboarding', async () => {
    const profile = await finishOnboarding(client);
    expect(profile.onboarded).toBe(true);
    expect(profile.counts).toEqual({ followers: 0, following: 0, dishes: 0 });
    expect((await getMyProfile(client))?.onboarded).toBe(true);
  });

  it('uploads an avatar, serves it, and replaces it removing the old file', async () => {
    const first = await uploadMyAvatar(client, TINY_JPEG);
    expect(first.avatarUrl).toMatch(/\/storage\/v1\/object\/public\/avatars\/.+\/avatar-\d+\.jpg$/);
    const res = await fetch(first.avatarUrl!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');

    await new Promise((resolve) => setTimeout(resolve, 5)); // a different millisecond
    const second = await uploadMyAvatar(client, TINY_JPEG);
    expect(second.avatarUrl).not.toBe(first.avatarUrl);
    expect((await fetch(second.avatarUrl!)).status).toBe(200);
    expect((await fetch(first.avatarUrl!)).ok).toBe(false);
    expect((await getMyProfile(client))?.avatarUrl).toBe(second.avatarUrl);
  });
});

describe('two people racing for one handle (local Supabase)', () => {
  it('lets exactly one win; the other gets username_taken', async () => {
    const suffix = randomSuffix();
    const a = newTestClient();
    const b = newTestClient();
    await Promise.all([signUpFreshUser(a), signUpFreshUser(b)]);

    const results = await Promise.allSettled([
      createMyProfile(a, { displayName: 'Racer A', username: `Race_${suffix}` }),
      createMyProfile(b, { displayName: 'Racer B', username: `race_${suffix}` }),
    ]);
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(lost[0]).toMatchObject({ reason: { name: 'ApiError', code: 'username_taken' } });
  });
});
