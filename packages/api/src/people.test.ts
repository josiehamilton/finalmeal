import { describe, expect, it } from 'vitest';
import {
  followUser,
  listFollowing,
  pageSize,
  respondToFollowRequest,
  unfollowUser,
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

  it('sends the right arguments for unfollow, respond and the following list', async () => {
    const { client, calls } = fakeClient(() => ({ data: [] }));
    await unfollowUser(client, 'u2');
    await respondToFollowRequest(client, 'u3', false);
    await listFollowing(client, 'u4', { offset: 40 });
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ['unfollow_user', { p_user_id: 'u2' }],
      ['respond_follow_request', { p_follower_id: 'u3', p_accept: false }],
      ['list_following', { p_user_id: 'u4', p_q: undefined, p_offset: 40, p_limit: 20 }],
    ]);
  });
});

describe('pageSize', () => {
  it('caps at 50, floors at 0 and falls back to 20 for a non-number', () => {
    expect(pageSize(20)).toBe(20);
    expect(pageSize(500)).toBe(50);
    expect(pageSize(-3)).toBe(0);
    expect(pageSize(7.9)).toBe(7);
    expect(pageSize(Number.NaN)).toBe(20);
    expect(pageSize(Number.POSITIVE_INFINITY)).toBe(20);
  });
});
