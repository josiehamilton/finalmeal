import { makeDiscoverDish } from '../test-support/discover';
import { PLACE } from '../test-support/add-dish';
import { whereLine } from './SelectedPlaceSheet';

describe('whereLine', () => {
  it('puts the area first and leaves out a missing distance', () => {
    const place = { ...PLACE, name: 'Kin Kao', area: 'Main St', address: '1 Main St, Vancouver, BC' };
    expect(whereLine(makeDiscoverDish({ place, distanceM: null }))).toBe('Kin Kao · Main St');
  });

  it('shows the street, not the full address, when there is no area', () => {
    const place = { ...PLACE, name: 'Kin Kao', area: null, address: '1 Main St, Vancouver, BC V6A' };
    expect(whereLine(makeDiscoverDish({ place, distanceM: 1800 }))).toBe('Kin Kao · 1 Main St · 1.8 km');
  });
});
