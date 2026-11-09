import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISCOVER_FILTERS,
  RADIUS_SLIDER_MAX,
  citiesLine,
  followersLabel,
  formatDistance,
  listsLabel,
  mapSummary,
  picksNearLabel,
  placeCallout,
  radiusFromSlider,
  radiusLabel,
  sheetFilterCount,
  sliderFromRadius,
  tierCountsLabel,
} from './discover';
import type { PickLike } from './group';

function pickIn(city: string, region: string | null = null, country = 'CA'): PickLike {
  return { place: { id: `${city}-${Math.random()}`, city, region, country }, tags: [] };
}

describe('defaults and the radius slider', () => {
  it('starts unfiltered', () => {
    expect(DEFAULT_DISCOVER_FILTERS).toEqual({
      tier: 'all',
      followingOnly: false,
      radiusKm: null,
      foodTypeIds: [],
      dietaryIds: [],
    });
  });

  it('treats the last stop as Any and rounds the rest', () => {
    expect(RADIUS_SLIDER_MAX).toBe(100);
    expect(radiusFromSlider(100)).toBeNull();
    expect(radiusFromSlider(25.4)).toBe(25);
    expect(radiusFromSlider(1)).toBe(1);
    expect(radiusFromSlider(0)).toBe(1);
    expect(radiusFromSlider(99.4)).toBe(99);
  });

  it('maps a radius back onto the slider', () => {
    expect(sliderFromRadius(null)).toBe(100);
    expect(sliderFromRadius(25)).toBe(25);
    expect(sliderFromRadius(500)).toBe(99);
  });

  it('labels the radius', () => {
    expect(radiusLabel(null)).toBe('Any');
    expect(radiusLabel(25)).toBe('25 km');
  });
});

describe('sheetFilterCount', () => {
  it('counts a radius and each tag, not the tier or Following', () => {
    expect(sheetFilterCount(DEFAULT_DISCOVER_FILTERS)).toBe(0);
    expect(
      sheetFilterCount({
        tier: 'final',
        followingOnly: true,
        radiusKm: 10,
        foodTypeIds: ['a', 'b'],
        dietaryIds: ['c'],
      }),
    ).toBe(4);
  });
});

describe('labels', () => {
  it('picksNearLabel', () => {
    expect(picksNearLabel(12, 'Vancouver')).toBe('12 picks near Vancouver');
    expect(picksNearLabel(1, 'Vancouver')).toBe('1 pick near Vancouver');
    expect(picksNearLabel(12, null)).toBe('12 picks here');
  });

  it('formatDistance', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(1234)).toBe('1.2 km');
    expect(formatDistance(12_300)).toBe('12 km');
    expect(formatDistance(99_400)).toBe('99 km');
    expect(formatDistance(100_000)).toBeNull();
    expect(formatDistance(250_000)).toBeNull();
    expect(formatDistance(null)).toBeNull();
    // rounding never produces "1000 m", "10.0 km" or "100 km"
    expect(formatDistance(999.6)).toBe('1.0 km');
    expect(formatDistance(9_960)).toBe('10 km');
    expect(formatDistance(99_700)).toBeNull();
  });

  it('listsLabel and placeCallout', () => {
    expect(listsLabel(14)).toBe('14 lists');
    expect(listsLabel(1)).toBe('1 list');
    expect(listsLabel(0)).toBeNull();
    expect(placeCallout('Marutama', 14)).toBe('Marutama · 14 lists');
    expect(placeCallout('Marutama', 1)).toBe('Marutama · 1 list');
    expect(placeCallout('Marutama', 0)).toBe('Marutama');
  });

  it('tierCountsLabel puts the lead tier first and drops zero parts', () => {
    expect(tierCountsLabel(2, 6, 'honorable')).toBe('Honorable for 6 people · Final Meal for 2');
    expect(tierCountsLabel(2, 6, 'final')).toBe('Final Meal for 2 people · Honorable for 6');
    expect(tierCountsLabel(1, 0, 'final')).toBe('Final Meal for 1 person');
    expect(tierCountsLabel(0, 1, 'honorable')).toBe('Honorable for 1 person');
    expect(tierCountsLabel(0, 0, 'final')).toBeNull();
  });

  it('followersLabel', () => {
    expect(followersLabel(567)).toBe('567 followers');
    expect(followersLabel(1)).toBe('1 follower');
  });
});

describe('mapSummary and citiesLine', () => {
  const picks = [
    pickIn('Vancouver'),
    pickIn('Vancouver'),
    pickIn('Tokyo', null, 'JP'),
    pickIn('Paris', null, 'FR'),
  ];

  it('summarises picks and cities', () => {
    expect(mapSummary(picks, 'Sushi')).toBe('Sushi · 4 picks in 3 cities');
    expect(mapSummary(picks, null)).toBe('4 picks in 3 cities');
    expect(mapSummary([pickIn('Vancouver')], null)).toBe('1 pick in 1 city');
  });

  it('counts cities by key, so two Vancouvers stay apart', () => {
    expect(mapSummary([pickIn('Vancouver', 'BC'), pickIn('Vancouver', 'WA', 'US')], null)).toBe(
      '2 picks in 2 cities',
    );
  });

  it('lists the busiest cities first and counts the rest', () => {
    expect(citiesLine(picks)).toBe('Vancouver, Tokyo, Paris');
    const five = [
      pickIn('A'),
      pickIn('B'),
      pickIn('B'),
      pickIn('C'),
      pickIn('C'),
      pickIn('C'),
      pickIn('D'),
      pickIn('E'),
    ];
    expect(citiesLine(five)).toBe('C, B, A +2');
    expect(citiesLine(five, 5)).toBe('C, B, A, D, E');
    expect(citiesLine([])).toBe('');
  });
});
