import { describe, expect, it, vi } from 'vitest';
import type { FinalMealClient } from './client';
import { suggestDishes } from './dishes';

describe('suggestDishes', () => {
  it('asks for dishes at a place and maps them with their pick counts', async () => {
    const retry = vi.fn().mockResolvedValue({
      data: [{ dish: { id: 'd1', name: 'Tonkotsu Ramen', place_id: 'p1' }, pick_count: 3 }],
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ retry });
    const client = { rpc } as unknown as FinalMealClient;
    const dishes = await suggestDishes(client, 'p1', ' tonk ', 4);
    expect(rpc).toHaveBeenCalledWith(
      'suggest_dishes',
      { p_place_id: 'p1', p_q: 'tonk', p_lim: 4 },
      { get: true },
    );
    expect(dishes).toEqual([{ id: 'd1', name: 'Tonkotsu Ramen', pickCount: 3 }]);
  });
});
