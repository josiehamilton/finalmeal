import { describe, expect, it } from 'vitest';
import {
  followUser,
  getProfile,
  getSuggestedPeople,
  listFollowers,
  searchPeople,
  toFollowState,
} from './people';
import { fakeClient } from './test-support/fake-client';

const PERSON = {
  id: 'u1',
  username: 'arimitchell',
  display_name: 'Ari Mitchell',
  avatar_path: 'u1/avatar.jpg',
  viewer_follow: 'active',
  follows_viewer: true,
  is_me: false,
};

describe('people wrappers', () => {
  it('maps a profile row, with avatar URL and a hidden private account', async () => {
    const { client, calls } = fakeClient(() => ({
      data: [
        {
          ...PERSON,
          bio: null,
          home_city: null,
          visibility: 'private',
          followers_count: 12,
          following_count: 3,
          dishes_count: null,
          can_see_picks: false,
        },
      ],
    }));
    expect(await getProfile(client, 'u1')).toEqual({
      id: 'u1',
      username: 'arimitchell',
      displayName: 'Ari Mitchell',
      avatarUrl: 'https://files.test/avatars/u1/avatar.jpg',
      bio: null,
      homeCity: null,
      visibility: 'private',
      counts: { followers: 12, following: 3, dishes: null },
      viewerFollow: 'active',
      followsViewer: true,
      canSeePicks: false,
      isMe: false,
    });
    expect(calls[0]).toMatchObject({ name: 'get_profile', args: { p_user_id: 'u1' } });
  });

  it('returns null when there is no profile row', async () => {
    const { client } = fakeClient(() => ({ data: [] }));
    expect(await getProfile(client, 'u1')).toBeNull();
  });

  it('reads the follow state, treating anything unknown as none', async () => {
    expect(toFollowState('active')).toBe('active');
    expect(toFollowState('requested')).toBe('requested');
    expect(toFollowState('nonsense')).toBe('none');
    const { client } = fakeClient(() => ({ data: 'requested' }));
    expect(await followUser(client, 'u2')).toBe('requested');
  });

  it('turns a database error into an ApiError with the friendly code', async () => {
    const { client } = fakeClient(() => ({
      error: { message: 'profile_unavailable', code: 'P0001' },
    }));
    await expect(followUser(client, 'u2')).rejects.toMatchObject({ code: 'profile_unavailable' });
  });

  it('maps a person with no avatar and passes list options through, capping the page at 50', async () => {
    const { client, calls } = fakeClient(() => ({ data: [{ ...PERSON, avatar_path: null }] }));
    const [row] = await listFollowers(client, 'u9', { q: '  ari ', offset: 20, limit: 500 });
    expect(row).toEqual({
      id: 'u1',
      username: 'arimitchell',
      displayName: 'Ari Mitchell',
      avatarUrl: null,
      viewerFollow: 'active',
      followsViewer: true,
      isMe: false,
    });
    expect(calls[0]).toMatchObject({
      name: 'list_followers',
      args: { p_user_id: 'u9', p_q: 'ari', p_offset: 20, p_limit: 50 },
      options: { get: true },
    });
  });

  it('sends no query when the list filter is blank', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await listFollowers(client, 'u9', { q: '   ' });
    expect(calls[0]!.args).toMatchObject({ p_q: undefined, p_offset: 0, p_limit: 20 });
  });

  it('searches people only for a non-blank query', async () => {
    const { client, calls } = fakeClient(() => ({ data: [PERSON] }));
    expect(await searchPeople(client, '   ')).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(await searchPeople(client, ' ari ')).toHaveLength(1);
    expect(calls[0]).toMatchObject({ name: 'search_people', args: { p_q: 'ari', p_limit: 20 } });
  });

  it('adds the top dish to suggested people', async () => {
    const { client } = fakeClient(() => ({
      data: [{ ...PERSON, viewer_follow: 'none', top_dish: 'Pork Gyro' }],
    }));
    expect(await getSuggestedPeople(client, 5)).toMatchObject([
      { username: 'arimitchell', viewerFollow: 'none', topDish: 'Pork Gyro' },
    ]);
  });
});
