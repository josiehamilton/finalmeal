import type { LatLng, MapBounds } from './api-stand-ins';

export interface MapCamera {
  lat: number;
  lng: number;
  zoom: number;
}

/** What the map is showing: its box, centre and zoom. A box across the antimeridian has `west > east`. */
export interface MapRegion {
  bounds: MapBounds;
  center: LatLng;
  zoom: number;
}

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  tier: 'final' | 'honorable';
  /** The callout shown under the pin when it is selected. */
  label: string;
}

/** App to map. */
export type MapCommand =
  | { type: 'setPins'; pins: MapPin[] }
  | { type: 'select'; id: string | null }
  | { type: 'flyTo'; camera: MapCamera }
  | { type: 'fitPins'; maxZoom: number }
  | { type: 'setInsets'; top: number; bottom: number };

/** Map to app. */
export type MapEvent =
  | { type: 'ready' }
  | { type: 'region'; region: MapRegion }
  | { type: 'pinPress'; id: string }
  | { type: 'mapPress' }
  | { type: 'error'; reason: 'load' | 'style' };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function inRange(v: unknown, min: number, max: number): v is number {
  return finite(v) && v >= min && v <= max;
}

function parseLatLng(v: unknown): LatLng | null {
  if (!isRecord(v) || !inRange(v.lat, -90, 90) || !inRange(v.lng, -180, 180)) return null;
  return { lat: v.lat, lng: v.lng };
}

function parseRegion(v: unknown): MapRegion | null {
  if (!isRecord(v) || !isRecord(v.bounds) || !finite(v.zoom)) return null;
  const b = v.bounds;
  const center = parseLatLng(v.center);
  if (
    !center ||
    !inRange(b.south, -90, 90) ||
    !inRange(b.north, -90, 90) ||
    !inRange(b.west, -180, 180) ||
    !inRange(b.east, -180, 180)
  ) {
    return null;
  }
  return {
    bounds: { west: b.west, south: b.south, east: b.east, north: b.north },
    center,
    zoom: v.zoom,
  };
}

/** Reads a message from the map page. Anything that is not exactly an event is null. */
export function parseMapEvent(data: string): MapEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'ready':
      return { type: 'ready' };
    case 'mapPress':
      return { type: 'mapPress' };
    case 'pinPress':
      return typeof raw.id === 'string' ? { type: 'pinPress', id: raw.id } : null;
    case 'error':
      return raw.reason === 'load' || raw.reason === 'style'
        ? { type: 'error', reason: raw.reason }
        : null;
    case 'region': {
      const region = parseRegion(raw.region);
      return region ? { type: 'region', region } : null;
    }
    default:
      return null;
  }
}

/**
 * The script that hands a command to the page. The command is JSON, so a label with a quote or
 * `</script>` is only ever data; `<` is escaped as well, so that text never appears. U+2028 and
 * U+2029 are escaped too: JSON allows them, older JavaScript engines do not accept them inside a
 * string literal.
 */
export function commandScript(cmd: MapCommand): string {
  const json = JSON.stringify(cmd)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `window.__fm&&window.__fm.receive(${json});true;`;
}
