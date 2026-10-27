import { describe, expect, it } from 'vitest';
import { chipOptions, filterPicks, groupPicksByPlace, summarizeGroups } from './group';
import type { PickLike } from './group';

type TagKind = 'food_type' | 'dietary' | 'personal';

function tag(kind: TagKind, name: string) {
  return { kind, name, slug: name.toLowerCase().replace(/\s+/g, '-') };
}

interface TestPick extends PickLike {
  id: string;
  place: { id: string; name: string; city: string };
}

function pick(
  id: string,
  placeName: string,
  city: string,
  tags: Array<ReturnType<typeof tag>> = [],
): TestPick {
  return { id, place: { id: `place-${placeName}`, name: placeName, city }, tags };
}

const VAN = 'Vancouver';

/** Josie's seeded honorables in Vancouver (the ProfileHM board): 7 picks at 5 spots. */
const HONORABLES = [
  pick('tonkotsu', 'Marutama', VAN, [tag('food_type', 'Ramen'), tag('food_type', 'Noodles')]),
  pick('khao-soi', 'Kin Kao', VAN, [
    tag('food_type', 'Thai'),
    tag('food_type', 'Noodles'),
    tag('dietary', 'Dairy-free'),
  ]),
  pick('aburi', 'Miku', VAN, [tag('food_type', 'Sushi')]),
  pick('dan-dan', 'Lotus Noodle Bar', VAN, [tag('food_type', 'Noodles'), tag('dietary', 'Vegan')]),
  pick('gyoza', 'Marutama', VAN),
  pick('rice-salad', 'Kin Kao', VAN),
  pick('bun', 'Hearth Bakery', VAN, [tag('personal', 'Rainy day')]),
];

describe('groupPicksByPlace', () => {
  it('groups picks by place in first-seen order', () => {
    const groups = groupPicksByPlace(HONORABLES);
    expect(groups.map((g) => g.place.name)).toEqual([
      'Marutama',
      'Kin Kao',
      'Miku',
      'Lotus Noodle Bar',
      'Hearth Bakery',
    ]);
    expect(groups[0]?.picks.map((p) => p.id)).toEqual(['tonkotsu', 'gyoza']);
    expect(groups[1]?.picks.map((p) => p.id)).toEqual(['khao-soi', 'rice-salad']);
    expect(groups[2]?.picks).toHaveLength(1);
  });

  it('returns nothing for no picks', () => {
    expect(groupPicksByPlace([])).toEqual([]);
  });
});

describe('summarizeGroups', () => {
  it('says "7 picks at 5 spots" for the ProfileHM example', () => {
    expect(summarizeGroups(groupPicksByPlace(HONORABLES))).toBe('7 picks at 5 spots');
  });

  it('is singular at one', () => {
    expect(summarizeGroups(groupPicksByPlace([HONORABLES[0]!]))).toBe('1 pick at 1 spot');
  });

  it('is plural for several picks at one spot', () => {
    const groups = groupPicksByPlace([HONORABLES[0]!, HONORABLES[4]!]);
    expect(summarizeGroups(groups)).toBe('2 picks at 1 spot');
  });

  it('handles none', () => {
    expect(summarizeGroups([])).toBe('0 picks at 0 spots');
  });
});

describe('filterPicks', () => {
  const picks = [
    ...HONORABLES,
    pick('omakase', 'Sushi Dai', 'Tokyo', [tag('food_type', 'Sushi'), tag('dietary', 'Vegan')]),
  ];

  it('returns everything without a filter', () => {
    expect(filterPicks(picks, {})).toHaveLength(8);
  });

  it('filters by city', () => {
    expect(filterPicks(picks, { city: 'Tokyo' }).map((p) => p.id)).toEqual(['omakase']);
  });

  it('filters by a global tag slug (food type or dietary)', () => {
    expect(filterPicks(picks, { tagSlug: 'sushi' }).map((p) => p.id)).toEqual(['aburi', 'omakase']);
    expect(filterPicks(picks, { tagSlug: 'vegan' }).map((p) => p.id)).toEqual([
      'dan-dan',
      'omakase',
    ]);
  });

  it('filters by a personal tag slug, which a global tag never matches', () => {
    expect(filterPicks(picks, { personalTagSlug: 'rainy-day' }).map((p) => p.id)).toEqual(['bun']);
    expect(filterPicks(picks, { tagSlug: 'rainy-day' })).toEqual([]);
    expect(filterPicks(picks, { personalTagSlug: 'sushi' })).toEqual([]);
  });

  it('combines filters with AND', () => {
    expect(filterPicks(picks, { city: VAN, tagSlug: 'sushi' }).map((p) => p.id)).toEqual(['aburi']);
    expect(filterPicks(picks, { city: 'Tokyo', tagSlug: 'ramen' })).toEqual([]);
  });
});

describe('chipOptions', () => {
  const picks = [
    ...HONORABLES,
    pick('omakase', 'Sushi Dai', 'Tokyo', [tag('food_type', 'Sushi'), tag('dietary', 'Vegan')]),
    pick('nigiri', 'Sushi Itto', 'Tokyo', [tag('food_type', 'Sushi'), tag('personal', 'Splurge')]),
    pick('lobster', 'Luke’s', 'Portland', [tag('personal', 'Rainy day')]),
  ];

  it('lists cities by count, then food types, dietary and personal tags', () => {
    const chips = chipOptions(picks);
    expect(chips.map((c) => [c.kind, c.label, c.count])).toEqual([
      ['city', 'Vancouver', 7],
      ['city', 'Tokyo', 2],
      ['city', 'Portland', 1],
      // food types: noodles 3, sushi 3 (name order breaks the tie), ramen 1, thai 1
      ['tag', 'Noodles', 3],
      ['tag', 'Sushi', 3],
      ['tag', 'Ramen', 1],
      ['tag', 'Thai', 1],
      // dietary: vegan 2, dairy-free 1
      ['tag', 'Vegan', 2],
      ['tag', 'Dairy-free', 1],
      // personal: rainy day 2, splurge 1
      ['tag', 'Rainy day', 2],
      ['tag', 'Splurge', 1],
    ]);
  });

  it('carries the filter value: the city name or the tag slug, with the tag kind', () => {
    const chips = chipOptions(picks);
    expect(chips[0]).toMatchObject({ kind: 'city', value: 'Vancouver' });
    expect(chips.find((c) => c.label === 'Rainy day')).toMatchObject({
      kind: 'tag',
      value: 'rainy-day',
      tagKind: 'personal',
    });
    expect(chips.find((c) => c.label === 'Vegan')).toMatchObject({
      value: 'vegan',
      tagKind: 'dietary',
    });
  });

  it('counts a tag once per pick even if it is repeated', () => {
    const chips = chipOptions([
      pick('a', 'X', 'Y', [tag('food_type', 'Ramen'), tag('food_type', 'Ramen')]),
    ]);
    expect(chips.find((c) => c.label === 'Ramen')?.count).toBe(1);
  });

  it('is empty for no picks', () => {
    expect(chipOptions([])).toEqual([]);
  });
});
