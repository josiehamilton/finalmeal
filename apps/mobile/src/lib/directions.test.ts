import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { directionsUrl, openDirections } from './directions';
import { PLACE } from '../test-support/add-dish';

jest.mock('expo-linking', () => ({ openURL: jest.fn().mockResolvedValue(true) }));

const CUSTOM = {
  ...PLACE,
  id: 'p2',
  name: 'Taco Truck',
  source: 'custom' as const,
  address: '123 Main St',
  city: 'Vancouver',
  region: 'BC',
  lat: 1,
  lng: 2,
};
const TRUCK = { ...CUSTOM, address: null };

describe('directionsUrl', () => {
  it('uses the coordinates and name of a Foursquare spot on iOS (Apple Maps)', () => {
    expect(directionsUrl(PLACE, 'ios')).toBe(
      'https://maps.apple.com/?ll=49.29,-123.13&q=Marutama%20Ramen',
    );
  });

  it('uses the coordinates and name of a Foursquare spot on Android (Google Maps)', () => {
    expect(directionsUrl(PLACE, 'android')).toBe(
      'geo:49.29,-123.13?q=49.29,-123.13(Marutama%20Ramen)',
    );
  });

  it('uses name, address and city for a custom spot, never its coordinates', () => {
    expect(directionsUrl(CUSTOM, 'ios')).toBe(
      'https://maps.apple.com/?q=Taco%20Truck%2C%20123%20Main%20St%2C%20Vancouver',
    );
    expect(directionsUrl(CUSTOM, 'android')).toBe(
      'geo:0,0?q=Taco%20Truck%2C%20123%20Main%20St%2C%20Vancouver',
    );
  });

  it('uses only the city for a spot with no fixed address', () => {
    expect(directionsUrl(TRUCK, 'ios')).toBe('https://maps.apple.com/?q=Vancouver%2C%20BC');
    expect(directionsUrl(TRUCK, 'android')).toBe('geo:0,0?q=Vancouver%2C%20BC');
  });
});

describe('openDirections', () => {
  afterEach(() => jest.clearAllMocks());

  it('opens the URL for the current platform', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await openDirections(PLACE);
    expect(Linking.openURL).toHaveBeenCalledWith(
      'geo:49.29,-123.13?q=49.29,-123.13(Marutama%20Ramen)',
    );
    jest.restoreAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
    await openDirections(PLACE);
    expect(Linking.openURL).toHaveBeenLastCalledWith(
      'https://maps.apple.com/?ll=49.29,-123.13&q=Marutama%20Ramen',
    );
  });
});
