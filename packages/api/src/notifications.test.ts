import { describe, expect, it, vi } from 'vitest';
import type { FinalMealClient } from './client';
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationsRead,
  subscribeToMyNotifications,
  toNotificationSettings,
} from './notifications';
import { registerPushToken } from './push';
import { fakeClient } from './test-support/fake-client';

const ROW = {
  id: 'n1',
  created_at: '2026-11-03T12:00:00.5+00:00',
  read_at: null,
  type: 'dethroned',
  actor_id: 'a1',
  actor_username: 'arimitchell',
  actor_display_name: 'Ari Mitchell',
  actor_avatar_path: null,
  pick_id: 'p1',
  dish_name: 'Smash Burger',
  photo_path: 'a1/burger.jpg',
  other_dish_name: 'Tacos Al Pastor',
  list_title: null,
  viewer_follow: 'requested',
  request_pending: false,
};

describe('notifications wrappers', () => {
  it('maps a notification row', async () => {
    const { client, calls } = fakeClient(() => ({ data: [ROW] }));
    expect(await getMyNotifications(client, { before: 'T', limit: 99 })).toEqual([
      {
        id: 'n1',
        type: 'dethroned',
        at: '2026-11-03T12:00:00.5+00:00',
        readAt: null,
        actor: { id: 'a1', username: 'arimitchell', displayName: 'Ari Mitchell', avatarUrl: null },
        pickId: 'p1',
        dishName: 'Smash Burger',
        otherDishName: 'Tacos Al Pastor',
        listTitle: null,
        photoUrl: 'https://files.test/pick-photos/a1/burger.jpg',
        viewerFollow: 'requested',
        requestPending: false,
      },
    ]);
    expect(calls[0]).toMatchObject({
      name: 'get_my_notifications',
      args: { p_before: 'T', p_limit: 50 },
    });
  });

  it('reads the unread count and marks read (one, some or all)', async () => {
    const count = fakeClient(() => ({ data: 3 }));
    expect(await getUnreadCount(count.client)).toBe(3);
    const none = fakeClient(() => ({ data: null }));
    expect(await getUnreadCount(none.client)).toBe(0);

    const { client, calls } = fakeClient(() => ({}));
    await markNotificationsRead(client, ['n1']);
    await markNotificationsRead(client);
    expect(calls.map((c) => c.args)).toEqual([{ p_ids: ['n1'] }, { p_ids: undefined }]);
  });

  it('maps the preference columns to settings', () => {
    expect(
      toNotificationSettings({
        push_dethroned: true,
        push_new_followers: false,
        push_saves: true,
        push_friends_finals: false,
      }),
    ).toEqual({ dethroned: true, newFollowers: false, saves: true, friendsFinals: false });
  });

  it('registers a push token and maps invalid_push_token', async () => {
    const ok = fakeClient(() => ({}));
    await registerPushToken(ok.client, 'ExponentPushToken[x]', 'android');
    expect(ok.calls[0]).toMatchObject({
      name: 'register_push_token',
      args: { p_token: 'ExponentPushToken[x]', p_platform: 'android' },
    });
    const bad = fakeClient(() => ({ error: { message: 'invalid_push_token', code: 'P0001' } }));
    await expect(registerPushToken(bad.client, 'x', 'ios')).rejects.toMatchObject({
      code: 'invalid_push_token',
    });
  });
});

describe('subscribeToMyNotifications', () => {
  it('listens for inserts for this person and unsubscribes', () => {
    const channel = { on: vi.fn(), subscribe: vi.fn() };
    channel.on.mockReturnValue(channel);
    channel.subscribe.mockReturnValue(channel);
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(() => Promise.resolve('ok')),
    } as unknown as FinalMealClient;
    const onChange = vi.fn();

    const unsubscribe = subscribeToMyNotifications(client, 'u1', onChange);

    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.u1' },
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalled();
    const handler = channel.on.mock.calls[0]![2] as () => void;
    handler();
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
