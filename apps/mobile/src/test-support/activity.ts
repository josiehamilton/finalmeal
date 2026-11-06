import type { ActivityItem } from '@finalmeal/api';

/** The Notifications board's first row: Ari Mitchell dethroned Tacos Al Pastor with Smash Burger, 2m ago. */
export function makeActivity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: 'n1',
    type: 'dethroned',
    at: new Date(Date.now() - 2 * 60_000).toISOString(),
    readAt: null,
    actor: { id: 'u3', username: 'arimitchell', displayName: 'Ari Mitchell', avatarUrl: null },
    pickId: 'pk-ari',
    dishName: 'Smash Burger',
    otherDishName: 'Tacos Al Pastor',
    listTitle: null,
    photoUrl: null,
    viewerFollow: 'none',
    requestPending: false,
    ...overrides,
  };
}

/** Alli Mercer started following you, 14m ago (the board's second row). */
export function makeFollowed(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return makeActivity({
    id: 'n2',
    type: 'followed',
    at: new Date(Date.now() - 14 * 60_000).toISOString(),
    actor: { id: 'u4', username: 'allimercer', displayName: 'Alli Mercer', avatarUrl: null },
    pickId: null,
    dishName: null,
    otherDishName: null,
    ...overrides,
  });
}

/** Mike Brennan saved your Pork Gyro, 1h ago, already read (the board's third row). */
export function makeSaved(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return makeActivity({
    id: 'n3',
    type: 'saved_pick',
    at: new Date(Date.now() - 60 * 60_000).toISOString(),
    readAt: new Date().toISOString(),
    actor: { id: 'u5', username: 'mikebrennan', displayName: 'Mike Brennan', avatarUrl: null },
    pickId: 'pk-gyro',
    dishName: 'Pork Gyro',
    otherDishName: null,
    ...overrides,
  });
}

/** A follow request waiting for an answer. */
export function makeRequest(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return makeFollowed({
    id: 'n4',
    type: 'follow_requested',
    requestPending: true,
    ...overrides,
  });
}
