import { metresBetween } from './distance';

describe('metresBetween', () => {
  it('is zero for the same point', () => {
    expect(metresBetween({ lat: 49.28, lng: -123.12 }, { lat: 49.28, lng: -123.12 })).toBe(0);
  });

  it('measures about 111 km for one degree of latitude', () => {
    const m = metresBetween({ lat: 49, lng: -123 }, { lat: 50, lng: -123 });
    expect(m).toBeGreaterThan(111000);
    expect(m).toBeLessThan(111400);
  });

  it('goes the short way across the antimeridian', () => {
    expect(metresBetween({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 })).toBeLessThan(112000);
  });
});
