import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { Place } from '@finalmeal/api';

const enc = encodeURIComponent;

/** A geo: label sits inside parentheses, so parentheses in a name would end it early. */
function geoLabel(name: string): string {
  return name.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * What to search for when a spot has no trustworthy coordinates (a custom spot, whose point is
 * never the real location): the name, address and city, or only the city and region for a spot
 * with no fixed address (a food truck or pop-up has nothing to find by name).
 */
function customQuery(place: Place): string {
  const cityAndRegion = [place.city, place.region].filter(Boolean).join(', ');
  if (!place.address) return cityAndRegion;
  return [place.name, place.address, place.city].join(', ');
}

/**
 * The map link for a spot. Foursquare spots use their coordinates and name; custom spots use
 * text (see customQuery). iOS opens Apple Maps; Android opens its map app (Google Maps) through
 * a `geo:` link, which carries a label for the pin. Never uses the person's own location.
 */
export function directionsUrl(place: Place, os: 'ios' | 'android'): string {
  if (place.source === 'fsq') {
    const point = `${place.lat},${place.lng}`;
    return os === 'android'
      ? `geo:${point}?q=${point}(${enc(geoLabel(place.name))})`
      : `https://maps.apple.com/?ll=${point}&q=${enc(place.name)}`;
  }
  const query = enc(customQuery(place));
  return os === 'android' ? `geo:0,0?q=${query}` : `https://maps.apple.com/?q=${query}`;
}

/** Opens the spot in the platform's map app. Rejects if no app can open it. */
export async function openDirections(place: Place): Promise<void> {
  await Linking.openURL(directionsUrl(place, Platform.OS === 'android' ? 'android' : 'ios'));
}
