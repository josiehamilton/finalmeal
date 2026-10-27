import { describe, expect, it, vi } from 'vitest';
import type { FinalMealClient } from './client';
import { formatPlaceLabel, searchPlaces, toPlace } from './places';

const ROW = {
  id: 'p1',
  source: 'custom' as const,
  name: 'Marutama',
  area: 'Bidwell St',
  address: '780 Bidwell St, Vancouver, BC',
  city: 'Vancouver',
  region: 'BC',
  country: 'CA',
  location: { type: 'Point', coordinates: [-123.1366, 49.2905] },
};

describe('formatPlaceLabel', () => {
  it('uses the area and the city', () => {
    expect(
      formatPlaceLabel({ area: 'Bidwell St', address: '780 Bidwell St', city: 'Vancouver' }),
    ).toBe('Bidwell St · Vancouver');
  });

  it('falls back to the first part of the address before a comma', () => {
    expect(
      formatPlaceLabel({
        area: null,
        address: ' 780 Bidwell St , Vancouver, BC',
        city: 'Vancouver',
      }),
    ).toBe('780 Bidwell St · Vancouver');
  });

  it('is just the city with neither an area nor an address', () => {
    expect(formatPlaceLabel({ area: null, address: null, city: 'Vancouver' })).toBe('Vancouver');
    expect(formatPlaceLabel({ area: '  ', address: ' , x', city: 'Vancouver' })).toBe('Vancouver');
  });
});

describe('toPlace', () => {
  it('maps a row, reading the point from GeoJSON (longitude first)', () => {
    expect(toPlace(ROW)).toEqual({
      id: 'p1',
      name: 'Marutama',
      area: 'Bidwell St',
      address: '780 Bidwell St, Vancouver, BC',
      city: 'Vancouver',
      region: 'BC',
      country: 'CA',
      source: 'custom',
      lat: 49.2905,
      lng: -123.1366,
      label: 'Bidwell St · Vancouver',
    });
  });

  it('reads the point from the EWKB hex PostgREST sends for a geography column', () => {
    // A real value from the local database: POINT(-123.1557 49.2682), SRID 4326.
    const place = toPlace({
      ...ROW,
      location: '0101000020E61000002EFF21FDF6C95EC0C364AA6054A24840',
    });
    expect(place.lng).toBeCloseTo(-123.1557, 4);
    expect(place.lat).toBeCloseTo(49.2682, 4);
  });

  it('reads a plain WKB point without an SRID, and a big-endian one', () => {
    // POINT(1 2), little endian, then big endian.
    expect(
      toPlace({ ...ROW, location: '0101000000000000000000F03F0000000000000040' }),
    ).toMatchObject({
      lng: 1,
      lat: 2,
    });
    expect(
      toPlace({ ...ROW, location: '00000000013FF00000000000004000000000000000' }),
    ).toMatchObject({
      lng: 1,
      lat: 2,
    });
  });

  it('maps an fsq place and keeps nulls', () => {
    const place = toPlace({ ...ROW, source: 'fsq', area: null, address: null, region: null });
    expect(place).toMatchObject({ source: 'fsq', area: null, address: null, region: null });
    expect(place.label).toBe('Vancouver');
  });

  it('refuses a row with no readable point', () => {
    expect(() => toPlace({ ...ROW, location: 'garbage' })).toThrow(
      expect.objectContaining({ name: 'ApiError', code: 'unknown' }),
    );
  });
});

describe('searchPlaces', () => {
  it('returns nothing for a blank query without a point, without asking the backend', async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as FinalMealClient;
    expect(await searchPlaces(client, '   ')).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends the city point and maps the rows', async () => {
    const retry = vi.fn().mockResolvedValue({
      data: [{ place: ROW, distance_m: 12 }],
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ retry });
    const client = { rpc } as unknown as FinalMealClient;
    const places = await searchPlaces(client, ' maru ', { lat: 49.28, lng: -123.12 }, 5);
    expect(rpc).toHaveBeenCalledWith(
      'search_places',
      { p_q: 'maru', p_lat: 49.28, p_lng: -123.12, p_lim: 5 },
      { get: true },
    );
    expect(places.map((p) => p.name)).toEqual(['Marutama']);
  });
});
