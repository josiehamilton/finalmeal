import { describe, expect, it, vi } from 'vitest';
import type { FinalMealClient } from './client';
import { ApiError } from './errors';
import { addPick, sortPicks, toPick, updatePick } from './picks';
import type { Pick } from './picks';

/** A client that fails the test on any call, so a rejection that never touched the network is provable. */
function untouchedClient() {
  const touched = vi.fn();
  const client = new Proxy(
    {},
    {
      get: (_target, property) => {
        touched(String(property));
        throw new Error(`client.${String(property)} must not be used`);
      },
    },
  ) as unknown as FinalMealClient;
  return { client, touched };
}

function jpeg(length: number): ArrayBuffer {
  const bytes = new Uint8Array(length);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  return bytes.buffer;
}

const INPUT = { placeId: 'p1', dishName: 'Tonkotsu Ramen', tier: 'final' as const };

describe('addPick photo validation', () => {
  it('rejects text pretending to be a photo before any request', async () => {
    const { client, touched } = untouchedClient();
    const photo = new TextEncoder().encode('File not found').buffer as ArrayBuffer;
    await expect(addPick(client, { ...INPUT, photo })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'invalid_photo',
    });
    expect(touched).not.toHaveBeenCalled();
  });

  it('rejects a JPEG under 100 bytes before any request', async () => {
    const { client, touched } = untouchedClient();
    await expect(addPick(client, { ...INPUT, photo: jpeg(99) })).rejects.toMatchObject({
      code: 'invalid_photo',
    });
    expect(touched).not.toHaveBeenCalled();
  });

  it('lets a real JPEG through to the upload (the first backend call is the session lookup)', async () => {
    const { client, touched } = untouchedClient();
    await expect(addPick(client, { ...INPUT, photo: jpeg(100) })).rejects.toThrow(
      'client.auth must not be used',
    );
    expect(touched).toHaveBeenCalledWith('auth');
  });
});

describe('updatePick photo validation', () => {
  it('rejects a bad photo before any request', async () => {
    const { client, touched } = untouchedClient();
    const photo = new TextEncoder().encode('x'.repeat(500)).buffer as ArrayBuffer;
    await expect(updatePick(client, 'pick-1', { photo })).rejects.toMatchObject({
      code: 'invalid_photo',
    });
    expect(touched).not.toHaveBeenCalled();
  });
});

describe('addPick when the photo upload never finishes', () => {
  it('gives up after photoTimeoutMs, adds the pick without a photo and reports photoFailed', async () => {
    const upload = vi.fn().mockReturnValue(new Promise(() => undefined)); // hangs forever
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'pick-1' }, error: null });
    const single = vi.fn().mockResolvedValue({ data: PICK_ROW, error: null });
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
      },
      storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: 'x' } }) }) },
      rpc,
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => ({ retry: single }) }) }) }),
    } as unknown as FinalMealClient;
    const result = await addPick(client, { ...INPUT, photo: jpeg(100), photoTimeoutMs: 20 });
    expect(result.photoFailed).toBe(true);
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpc.mock.calls[0]?.[0]).toBe('add_pick');
    expect(args.p_photo_path).toBeUndefined();
    expect(args.p_dish_name).toBe('Tonkotsu Ramen');
    expect(result.pick.id).toBe('pick-1');
  });
});

/** A signed-in client whose photo upload, rpc and pick read are the given stubs. */
function stubClient(opts: {
  upload: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  remove?: ReturnType<typeof vi.fn>;
}) {
  const remove = opts.remove ?? vi.fn().mockResolvedValue({ data: [], error: null });
  const client = {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: opts.upload,
        remove,
        getPublicUrl: () => ({ data: { publicUrl: 'x' } }),
      }),
    },
    rpc: opts.rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => ({
            retry: vi.fn().mockResolvedValue({ data: PICK_ROW, error: null }),
          }),
        }),
      }),
    }),
  } as unknown as FinalMealClient;
  return { client, remove };
}

const UPLOADED = vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null });

describe('the photo file after a failed add or update', () => {
  const LOST_RESPONSE = { message: 'TypeError: fetch failed', code: '' };
  const TIMED_OUT = { message: 'TimeoutError: The operation timed out', code: '' };
  const REFUSED = { message: 'duplicate_pick', code: 'P0001' };
  const RAW_REFUSAL = { message: 'permission denied', code: '42501' };

  it.each([
    ['a lost response', LOST_RESPONSE],
    ['a timeout', TIMED_OUT],
    ['an error with no code', { message: 'something odd', code: '' }],
  ])(
    'keeps the uploaded photo when addPick fails with %s (the pick may have been saved)',
    async (_n, error) => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error });
      const { client, remove } = stubClient({ upload: UPLOADED, rpc });
      await expect(addPick(client, { ...INPUT, photo: jpeg(100) })).rejects.toBeInstanceOf(
        ApiError,
      );
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['a duplicate', REFUSED],
    ['a raw database refusal', RAW_REFUSAL],
  ])('deletes the uploaded photo when addPick is refused with %s', async (_n, error) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    const { client, remove } = stubClient({ upload: UPLOADED, rpc });
    await expect(addPick(client, { ...INPUT, photo: jpeg(100) })).rejects.toBeInstanceOf(ApiError);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0]?.[0]).toEqual([expect.stringMatching(/^u1\/pick-\d+\.jpg$/)]);
  });

  it.each([
    ['a lost response', LOST_RESPONSE],
    ['a timeout', TIMED_OUT],
  ])(
    'keeps the new photo when updatePick fails with %s (the update may have been saved)',
    async (_n, error) => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error });
      const { client, remove } = stubClient({ upload: UPLOADED, rpc });
      await expect(updatePick(client, 'pick-1', { photo: jpeg(100) })).rejects.toBeInstanceOf(
        ApiError,
      );
      expect(remove).not.toHaveBeenCalled();
    },
  );

  it('deletes the new photo when updatePick is definitely refused', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'invalid_tag', code: 'P0001' } });
    const { client, remove } = stubClient({ upload: UPLOADED, rpc });
    await expect(updatePick(client, 'pick-1', { photo: jpeg(100) })).rejects.toMatchObject({
      code: 'invalid_tag',
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('an upload that finishes after the timeout', () => {
  it('is deleted again, so no orphan is left behind', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const upload = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'pick-1' }, error: null });
    const { client, remove } = stubClient({ upload, rpc });
    const result = await addPick(client, { ...INPUT, photo: jpeg(100), photoTimeoutMs: 10 });
    expect(result.photoFailed).toBe(true);
    expect(remove).not.toHaveBeenCalled();

    finish({ data: { path: 'p' }, error: null }); // the upload lands after we gave up
    await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(remove.mock.calls[0]?.[0]).toEqual([expect.stringMatching(/^u1\/pick-\d+\.jpg$/)]);
  });

  it('leaves nothing to delete when it fails after the timeout', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const upload = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'pick-1' }, error: null });
    const { client, remove } = stubClient({ upload, rpc });
    await addPick(client, { ...INPUT, photo: jpeg(100), photoTimeoutMs: 10 });
    finish({ data: null, error: { message: 'too big', statusCode: '413' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(remove).not.toHaveBeenCalled();
  });
});

const PLACE = {
  id: 'pl1',
  source: 'custom' as const,
  name: 'Marutama',
  area: 'Bidwell St',
  address: null,
  city: 'Vancouver',
  region: 'BC',
  country: 'CA',
  location: { type: 'Point', coordinates: [-123.1, 49.2] },
};

const PICK_ROW = {
  id: 'pick-1',
  tier: 'final' as const,
  slot: 1,
  note: null,
  photo_path: null,
  original_dish_name: 'tonkotsu ramen',
  created_at: '2026-10-27T10:00:00Z',
  dish: { id: 'd1', name: 'Tonkotsu Ramen', place: PLACE },
  pick_tags: [
    {
      tag: {
        id: 't3',
        kind: 'personal' as const,
        name: 'Splurge',
        slug: 'splurge',
        is_featured: false,
      },
    },
    {
      tag: { id: 't2', kind: 'dietary' as const, name: 'Vegan', slug: 'vegan', is_featured: true },
    },
    {
      tag: {
        id: 't1',
        kind: 'food_type' as const,
        name: 'Ramen',
        slug: 'ramen',
        is_featured: true,
      },
    },
    {
      tag: {
        id: 't0',
        kind: 'food_type' as const,
        name: 'Noodles',
        slug: 'noodles',
        is_featured: true,
      },
    },
  ],
};

const photoUrl = (path: string) => `https://files.example/${path}`;

describe('toPick', () => {
  it('maps a row, keeps the person’s wording and orders tags by kind then name', () => {
    const pick = toPick(PICK_ROW, photoUrl);
    expect(pick).toMatchObject({
      id: 'pick-1',
      tier: 'final',
      slot: 1,
      dish: { id: 'd1', name: 'Tonkotsu Ramen' },
      originalDishName: 'tonkotsu ramen',
      note: null,
      photoUrl: null,
      createdAt: '2026-10-27T10:00:00Z',
    });
    expect(pick.place).toMatchObject({
      id: 'pl1',
      name: 'Marutama',
      label: 'Bidwell St · Vancouver',
    });
    expect(pick.tags.map((t) => t.name)).toEqual(['Noodles', 'Ramen', 'Vegan', 'Splurge']);
  });

  it('builds the photo address from the stored path', () => {
    const pick = toPick({ ...PICK_ROW, photo_path: 'u1/pick-5.jpg' }, photoUrl);
    expect(pick.photoUrl).toBe('https://files.example/u1/pick-5.jpg');
  });
});

describe('sortPicks', () => {
  function stub(id: string, tier: Pick['tier'], slot: number | null, createdAt: string): Pick {
    return { ...toPick(PICK_ROW, photoUrl), id, tier, slot, createdAt };
  }

  it('puts finals by slot first, then honorables newest first', () => {
    const sorted = sortPicks([
      stub('h-old', 'honorable', null, '2026-01-01T00:00:00Z'),
      stub('f3', 'final', 3, '2026-01-01T00:00:00Z'),
      stub('h-new', 'honorable', null, '2026-03-01T00:00:00Z'),
      stub('f1', 'final', 1, '2026-02-01T00:00:00Z'),
      stub('f2', 'final', 2, '2026-02-01T00:00:00Z'),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(['f1', 'f2', 'f3', 'h-new', 'h-old']);
  });
});
