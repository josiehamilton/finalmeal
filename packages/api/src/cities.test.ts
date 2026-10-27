import { describe, expect, it, vi } from 'vitest';
import type { FinalMealClient } from './client';
import { formatCityLabel, nearestCity, searchCities } from './cities';

describe('formatCityLabel', () => {
  it('uses the region code for Canada', () => {
    expect(
      formatCityLabel({
        name: 'Vancouver',
        regionCode: 'BC',
        regionName: 'British Columbia',
        country: 'CA',
        countryName: 'Canada',
      }),
    ).toBe('Vancouver, BC, Canada');
  });

  it('uses the region code for the US', () => {
    expect(
      formatCityLabel({
        name: 'Portland',
        regionCode: 'OR',
        regionName: 'Oregon',
        country: 'US',
        countryName: 'United States',
      }),
    ).toBe('Portland, OR, United States');
  });

  it('uses the region name outside US, CA and AU', () => {
    expect(
      formatCityLabel({
        name: 'Tokyo',
        regionCode: '40',
        regionName: 'Tokyo',
        country: 'JP',
        countryName: 'Japan',
      }),
    ).toBe('Tokyo, Tokyo, Japan');
  });

  it('skips empty parts', () => {
    expect(
      formatCityLabel({
        name: 'London',
        regionCode: null,
        regionName: null,
        country: 'GB',
        countryName: 'United Kingdom',
      }),
    ).toBe('London, United Kingdom');
    expect(
      formatCityLabel({
        name: 'London',
        regionCode: 'ENG',
        regionName: 'England',
        country: 'GB',
        countryName: 'United Kingdom',
      }),
    ).toBe('London, England, United Kingdom');
    expect(
      formatCityLabel({
        name: 'Sydney',
        regionCode: null,
        regionName: 'New South Wales',
        country: 'AU',
        countryName: 'Australia',
      }),
    ).toBe('Sydney, Australia');
  });
});

function clientThatMustNotBeCalled(): FinalMealClient {
  const rpc = vi.fn(() => {
    throw new Error('no network call expected');
  });
  return { rpc } as unknown as FinalMealClient;
}

describe('searchCities', () => {
  it('returns nothing for a blank query without calling the backend', async () => {
    await expect(searchCities(clientThatMustNotBeCalled(), '   ')).resolves.toEqual([]);
  });
});

describe('nearestCity', () => {
  it('returns null for coordinates that are not finite numbers without calling the backend', async () => {
    await expect(nearestCity(clientThatMustNotBeCalled(), Number.NaN, 5)).resolves.toBeNull();
  });
});
