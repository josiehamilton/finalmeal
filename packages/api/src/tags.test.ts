import { describe, expect, it, vi } from 'vitest';
import type { FinalMealClient } from './client';
import { createPersonalTag, searchTags, toTag } from './tags';

const ROW = {
  id: 't1',
  kind: 'food_type' as const,
  name: 'Ramen',
  slug: 'ramen',
  is_featured: true,
  aliases: [],
  display_order: 1,
  owner_id: null,
  created_at: 'now',
};

describe('toTag', () => {
  it('maps a tags row', () => {
    expect(toTag(ROW)).toEqual({
      id: 't1',
      kind: 'food_type',
      name: 'Ramen',
      slug: 'ramen',
      featured: true,
    });
  });
});

describe('searchTags', () => {
  it('searches by kind and text and maps the rows', async () => {
    const retry = vi.fn().mockResolvedValue({ data: [ROW], error: null });
    const rpc = vi.fn().mockReturnValue({ retry });
    const client = { rpc } as unknown as FinalMealClient;
    const tags = await searchTags(client, 'food_type', ' ram ', 5);
    expect(rpc).toHaveBeenCalledWith(
      'search_tags',
      { p_kind: 'food_type', p_q: 'ram', p_lim: 5 },
      { get: true },
    );
    expect(tags).toEqual([toTag(ROW)]);
  });

  it('turns a backend error into an ApiError', async () => {
    const retry = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'no', code: '42501' } });
    const client = { rpc: vi.fn().mockReturnValue({ retry }) } as unknown as FinalMealClient;
    await expect(searchTags(client, 'dietary', '')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('createPersonalTag', () => {
  it('creates the tag and maps it', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { ...ROW, kind: 'personal' }, error: null });
    const client = { rpc } as unknown as FinalMealClient;
    const tag = await createPersonalTag(client, 'Rainy day');
    expect(rpc).toHaveBeenCalledWith('create_personal_tag', { p_name: 'Rainy day' });
    expect(tag.kind).toBe('personal');
  });
});
