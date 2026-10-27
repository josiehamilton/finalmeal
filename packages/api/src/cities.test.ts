import { describe, expect, it, vi } from 'vitest';
import type { FinalMealClient } from './client';
import { formatCityLabel, getCity, nearestCity, searchCities } from './cities';

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
    ).toBe('Tokyo, Japan');
  });

  it.each([
    ['Seoul', 'Seoul', 'KR', 'South Korea', 'Seoul, South Korea'],
    ['Mexico City', 'Mexico City', 'MX', 'Mexico', 'Mexico City, Mexico'],
    ['Ho Chi Minh City', 'Ho Chi Minh City (HCMC)', 'VN', 'Vietnam', 'Ho Chi Minh City, Vietnam'],
    ['Osaka', 'OSAKA', 'JP', 'Japan', 'Osaka, Japan'],
  ])(
    'leaves out a region that repeats the city (%s, %s)',
    (name, regionName, country, countryName, label) => {
      expect(formatCityLabel({ name, regionCode: null, regionName, country, countryName })).toBe(
        label,
      );
    },
  );

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

describe('getCity', () => {
  function clientReading(data: unknown) {
    const retry = vi.fn().mockResolvedValue({ data, error: null });
    const eq = vi.fn(() => ({ maybeSingle: () => ({ retry }) }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { client: { from } as unknown as FinalMealClient, from, eq };
  }

  it('returns the city with its point (longitude first in GeoJSON)', async () => {
    const { client, from, eq } = clientReading({
      id: 'c1',
      name: 'Vancouver',
      region_code: 'BC',
      region_name: 'British Columbia',
      country: 'CA',
      country_name: 'Canada',
      location: { type: 'Point', coordinates: [-123.1207, 49.2827] },
    });
    await expect(getCity(client, 'c1')).resolves.toMatchObject({
      id: 'c1',
      label: 'Vancouver, BC, Canada',
      lat: 49.2827,
      lng: -123.1207,
    });
    expect(from).toHaveBeenCalledWith('cities');
    expect(eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('returns null when there is no such city', async () => {
    await expect(getCity(clientReading(null).client, 'nope')).resolves.toBeNull();
  });
});
