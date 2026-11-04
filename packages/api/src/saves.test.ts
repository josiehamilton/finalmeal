import { describe, expect, it } from 'vitest';
import { getMySaves, saveDish, unsaveDish } from './saves';
import { fakeClient } from './test-support/fake-client';

const PLACE = {
  id: 'pl1',
  source: 'custom',
  name: 'Skewers',
  area: 'Gastown',
  address: null,
  city: 'Vancouver',
  region: 'BC',
  country: 'CA',
  location: { type: 'Point', coordinates: [-123.1, 49.28] },
};

describe('saves wrappers', () => {
  it('maps a save with its via person (id and username only) and photo', async () => {
    const { client } = fakeClient(() => ({
      data: [
        {
          dish_id: 'd1',
          dish_name: 'Pork Gyro',
          place: PLACE,
          via_pick_id: 'p1',
          via_tier: 'final',
          via_user_id: 'u1',
          via_username: 'mikebrennan',
          photo_path: 'u1/gyro.jpg',
          saved_at: '2026-11-03T12:00:00+00:00',
          distance_m: 1234.5,
        },
      ],
    }));
    expect(await getMySaves(client)).toEqual([
      {
        dish: { id: 'd1', name: 'Pork Gyro' },
        place: expect.objectContaining({ id: 'pl1', label: 'Gastown · Vancouver' }),
        via: { id: 'u1', username: 'mikebrennan', displayName: 'mikebrennan', avatarUrl: null },
        viaPickId: 'p1',
        viaTier: 'final',
        photoUrl: 'https://files.test/pick-photos/u1/gyro.jpg',
        savedAt: '2026-11-03T12:00:00+00:00',
        distanceM: 1234.5,
      },
    ]);
  });

  it('maps a save whose pick is gone', async () => {
    const { client } = fakeClient(() => ({
      data: [
        {
          dish_id: 'd1',
          dish_name: 'Pork Gyro',
          place: PLACE,
          via_pick_id: null,
          via_tier: null,
          via_user_id: null,
          via_username: null,
          photo_path: null,
          saved_at: '2026-11-03T12:00:00+00:00',
          distance_m: null,
        },
      ],
    }));
    expect(await getMySaves(client)).toMatchObject([
      { via: null, viaPickId: null, viaTier: null, photoUrl: null, distanceM: null },
    ]);
  });

  it('sends the dish and the via pick, and maps dish_not_found', async () => {
    const ok = fakeClient(() => ({}));
    await saveDish(ok.client, 'd1', 'p1');
    expect(ok.calls[0]).toMatchObject({
      name: 'save_dish',
      args: { p_dish_id: 'd1', p_via_pick_id: 'p1' },
    });
    const gone = fakeClient(() => ({ error: { message: 'dish_not_found', code: 'P0001' } }));
    await expect(saveDish(gone.client, 'd1')).rejects.toMatchObject({ code: 'dish_not_found' });
  });

  it('sends the dish to unsave', async () => {
    const { client, calls } = fakeClient(() => ({}));
    await unsaveDish(client, 'd1');
    expect(calls[0]).toMatchObject({ name: 'unsave_dish', args: { p_dish_id: 'd1' } });
  });
});
