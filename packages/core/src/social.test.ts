import { describe, expect, it } from 'vitest';
import {
  NEARBY_RADIUS_M,
  activitySentence,
  countLabel,
  feedCaption,
  filterSaves,
  isSameLocalDay,
  othersAtPlaceLabel,
  relativeTime,
} from './social';
import type { SaveLike } from './social';

// A fixed "now" in local time, so the tests do not depend on the machine's time zone.
const NOW = new Date(2026, 10, 3, 14, 0, 0); // 3 Nov 2026, 14:00
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it.each([
    [0, 'now'],
    [30 * SECOND, 'now'],
    [59 * SECOND, 'now'],
    [60 * SECOND, '1m'],
    [2 * MINUTE, '2m'],
    [59 * MINUTE, '59m'],
    [60 * MINUTE, '1h'],
    [5 * HOUR, '5h'],
    [23 * HOUR + 59 * MINUTE, '23h'],
    [24 * HOUR, 'Yesterday'],
    [30 * HOUR, 'Yesterday'],
    [47 * HOUR, 'Yesterday'],
    [48 * HOUR, '2d'],
    [3 * DAY, '3d'],
    [6 * DAY + 23 * HOUR, '6d'],
    [7 * DAY, '27 Oct'],
    [9 * DAY, '25 Oct'],
  ])('labels %i ms ago as %s', (ms, label) => {
    expect(relativeTime(ago(ms), NOW)).toBe(label);
  });

  it('treats a time slightly in the future (clock skew) as now', () => {
    expect(relativeTime(new Date(NOW.getTime() + 5 * SECOND).toISOString(), NOW)).toBe('now');
  });
});

describe('isSameLocalDay', () => {
  it('is true within the same local day and false on another', () => {
    expect(isSameLocalDay(new Date(2026, 10, 3, 0, 5).toISOString(), NOW)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 10, 3, 23, 59).toISOString(), NOW)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 10, 2, 23, 59).toISOString(), NOW)).toBe(false);
    expect(isSameLocalDay(new Date(2025, 10, 3, 14, 0).toISOString(), NOW)).toBe(false);
  });
});

describe('feedCaption', () => {
  it('describes each kind', () => {
    expect(feedCaption('added_final', null)).toBe('added to their Final Meal');
    expect(feedCaption('added_honorable', null)).toBe('added an Honorable Mention');
    expect(feedCaption('promoted', null)).toBe('promoted to their Final Meal');
    expect(feedCaption('dethroned', 'Tacos Al Pastor')).toBe(
      'dethroned Tacos Al Pastor from their Final Meal',
    );
  });

  it('falls back when a dethroned card has no other dish', () => {
    expect(feedCaption('dethroned', null)).toBe('added to their Final Meal');
  });
});

describe('countLabel', () => {
  it('handles singular, plural and zero', () => {
    expect(countLabel(1, 'list')).toBe('On 1 list');
    expect(countLabel(8, 'list')).toBe('On 8 lists');
    expect(countLabel(1, 'finalMeal')).toBe('On 1 Final Meal');
    expect(countLabel(23, 'finalMeal')).toBe('On 23 Final Meals');
    expect(countLabel(0, 'list')).toBeNull();
    expect(countLabel(0, 'finalMeal')).toBeNull();
  });
});

describe('othersAtPlaceLabel', () => {
  it('handles singular, plural and zero', () => {
    expect(othersAtPlaceLabel(1, 'Vancouver', 'Skewers')).toBe(
      '1 other in Vancouver has Skewers on their list',
    );
    expect(othersAtPlaceLabel(8, 'Vancouver', 'Skewers')).toBe(
      '8 others in Vancouver have Skewers on their list',
    );
    expect(othersAtPlaceLabel(0, 'Vancouver', 'Skewers')).toBeNull();
  });
});

describe('activitySentence', () => {
  const base = {
    actorName: 'Ari Mitchell',
    dishName: null,
    otherDishName: null,
    listTitle: null,
    requestPending: false,
  };

  it('writes a dethroned sentence with name and dish segments', () => {
    expect(
      activitySentence({
        ...base,
        type: 'dethroned',
        dishName: 'Smash Burger',
        otherDishName: 'Tacos Al Pastor',
      }),
    ).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' dethroned ', style: 'plain' },
      { text: 'Tacos Al Pastor', style: 'dish' },
      { text: ' with ', style: 'plain' },
      { text: 'Smash Burger', style: 'dish' },
      { text: ' on their Final Meal.', style: 'plain' },
    ]);
  });

  it('writes the follow sentences', () => {
    expect(activitySentence({ ...base, type: 'followed' })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' started following you.', style: 'plain' },
    ]);
    expect(activitySentence({ ...base, type: 'follow_requested', requestPending: true })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' wants to follow you.', style: 'plain' },
    ]);
    expect(activitySentence({ ...base, type: 'follow_requested', requestPending: false })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' started following you.', style: 'plain' },
    ]);
    expect(activitySentence({ ...base, type: 'follow_accepted' })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' approved your follow request.', style: 'plain' },
    ]);
  });

  it('writes the save sentences', () => {
    expect(activitySentence({ ...base, type: 'saved_pick', dishName: 'Pork Gyro' })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' saved your ', style: 'plain' },
      { text: 'Pork Gyro', style: 'dish' },
      { text: '.', style: 'plain' },
    ]);
    expect(
      activitySentence({ ...base, type: 'saved_from_list', listTitle: 'Josie’s Vancouver' }),
    ).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' saved picks from your list ', style: 'plain' },
      { text: 'Josie’s Vancouver', style: 'dish' },
      { text: '.', style: 'plain' },
    ]);
  });

  it('writes the pick sentences', () => {
    expect(activitySentence({ ...base, type: 'added_final', dishName: 'Pork Gyro' })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' added ', style: 'plain' },
      { text: 'Pork Gyro', style: 'dish' },
      { text: ' to their Final Meal.', style: 'plain' },
    ]);
    expect(activitySentence({ ...base, type: 'promoted', dishName: 'Pork Gyro' })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' promoted ', style: 'plain' },
      { text: 'Pork Gyro', style: 'dish' },
      { text: ' to their Final Meal.', style: 'plain' },
    ]);
    expect(activitySentence({ ...base, type: 'added_honorable', dishName: 'Pork Gyro' })).toEqual([
      { text: 'Ari Mitchell', style: 'name' },
      { text: ' added ', style: 'plain' },
      { text: 'Pork Gyro', style: 'dish' },
      { text: ' as an Honorable Mention.', style: 'plain' },
    ]);
  });

  it('uses the same stand-ins as the push text when a dish is missing', () => {
    expect(activitySentence({ ...base, type: 'saved_pick' })[2]).toEqual({
      text: 'pick',
      style: 'dish',
    });
    expect(activitySentence({ ...base, type: 'added_final' })[2]).toEqual({
      text: 'a dish',
      style: 'dish',
    });
  });
});

describe('filterSaves', () => {
  const save = (via: SaveLike['viaTier'], distanceM: number | null): SaveLike => ({
    viaTier: via,
    distanceM,
  });
  const saves = [
    save('final', 100),
    save('honorable', NEARBY_RADIUS_M),
    save(null, NEARBY_RADIUS_M + 1),
    save('final', null),
  ];

  it('keeps everything for all', () => {
    expect(filterSaves(saves, 'all')).toEqual(saves);
  });

  it('filters by the tier of the pick it was saved from', () => {
    expect(filterSaves(saves, 'final')).toEqual([saves[0], saves[3]]);
    expect(filterSaves(saves, 'honorable')).toEqual([saves[1]]);
  });

  it('keeps only saves within the nearby radius, never ones without a distance', () => {
    expect(NEARBY_RADIUS_M).toBe(25000);
    expect(filterSaves(saves, 'nearby')).toEqual([saves[0], saves[1]]);
  });
});
