import { describe, expect, it } from 'vitest';
import {
  BIO_MAX,
  DISH_NAME_MAX,
  FINAL_MEAL_SIZE,
  NOTE_MAX,
  PLACE_ADDRESS_MAX,
  PLACE_NAME_MAX,
  TAG_NAME_MAX,
  DISPLAY_NAME_MAX,
  ONBOARDING_STEPS,
  PLACEHOLDER_LINK_DOMAIN,
  USERNAME_PATTERN,
  isPlausibleEmail,
  isValidUsername,
  normalizeEmail,
} from './index';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Josie@Example.com ')).toBe('josie@example.com');
  });
});

describe('isPlausibleEmail', () => {
  it('accepts a normal address', () => {
    expect(isPlausibleEmail('a@b.co')).toBe(true);
  });
  it.each(['a@b', '@b.co', ''])('rejects %j', (value) => {
    expect(isPlausibleEmail(value)).toBe(false);
  });
});

describe('isValidUsername', () => {
  it('accepts letters, numbers and underscores, 3 to 30 characters', () => {
    expect(isValidUsername('josie_h')).toBe(true);
    expect(isValidUsername('a'.repeat(30))).toBe(true);
  });
  it.each(['ab', 'josie hamilton', 'ジョシー', 'a'.repeat(31), ''])('rejects %j', (value) => {
    expect(isValidUsername(value)).toBe(false);
  });
  it('exposes the same pattern as the database check', () => {
    expect(USERNAME_PATTERN.source).toBe('^[A-Za-z0-9_]{3,30}$');
  });
});

describe('constants', () => {
  it('has the agreed limits', () => {
    expect(DISPLAY_NAME_MAX).toBe(60);
    expect(BIO_MAX).toBe(100);
    expect([DISH_NAME_MAX, PLACE_NAME_MAX, PLACE_ADDRESS_MAX, NOTE_MAX, TAG_NAME_MAX]).toEqual([
      80, 80, 200, 280, 40,
    ]);
    expect(FINAL_MEAL_SIZE).toBe(5);
    expect(ONBOARDING_STEPS).toBe(6);
    expect(PLACEHOLDER_LINK_DOMAIN).toBe('finalmeal.example');
  });
});
