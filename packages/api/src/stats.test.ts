import { describe, expect, it } from 'vitest';
import { formatStats } from './stats';

describe('formatStats', () => {
  it('pluralises and leaves picks out of the line', () => {
    expect(formatStats({ people: 6, places: 14, dishes: 17, picks: 28 })).toBe(
      '6 people · 14 places · 17 dishes',
    );
  });

  it('uses singular words when a count is 1', () => {
    expect(formatStats({ people: 1, places: 1, dishes: 1, picks: 1 })).toBe(
      '1 person · 1 place · 1 dish',
    );
  });

  it('pluralises zero', () => {
    expect(formatStats({ people: 0, places: 0, dishes: 0, picks: 0 })).toBe(
      '0 people · 0 places · 0 dishes',
    );
  });
});
