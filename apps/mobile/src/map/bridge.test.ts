import { commandScript, parseMapEvent } from './bridge';
import type { MapCommand, MapEvent } from './bridge';

const REGION = {
  bounds: { west: -123.2, south: 49.2, east: -123, north: 49.3 },
  center: { lat: 49.25, lng: -123.1 },
  zoom: 12.4,
};

function parse(value: unknown): MapEvent | null {
  return parseMapEvent(JSON.stringify(value));
}

describe('parseMapEvent', () => {
  it('accepts each event', () => {
    expect(parse({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(parse({ type: 'mapPress' })).toEqual({ type: 'mapPress' });
    expect(parse({ type: 'pinPress', id: 'p-1' })).toEqual({ type: 'pinPress', id: 'p-1' });
    expect(parse({ type: 'error', reason: 'load' })).toEqual({ type: 'error', reason: 'load' });
    expect(parse({ type: 'error', reason: 'style' })).toEqual({ type: 'error', reason: 'style' });
    expect(parse({ type: 'region', region: REGION })).toEqual({ type: 'region', region: REGION });
  });

  it('accepts a box across the antimeridian (west greater than east)', () => {
    const fiji = { ...REGION, bounds: { west: 170, south: -20, east: -175, north: -10 } };
    expect(parse({ type: 'region', region: fiji })).toEqual({ type: 'region', region: fiji });
  });

  it('drops fields it does not know', () => {
    expect(parse({ type: 'ready', extra: 1 })).toEqual({ type: 'ready' });
    const noisy = { ...REGION, bounds: { ...REGION.bounds, extra: 5 }, extra: 5 };
    expect(parse({ type: 'region', region: noisy })).toEqual({ type: 'region', region: REGION });
  });

  it('rejects bad JSON and things that are not objects', () => {
    expect(parseMapEvent('{nope')).toBeNull();
    expect(parseMapEvent('')).toBeNull();
    expect(parseMapEvent('null')).toBeNull();
    expect(parseMapEvent('"ready"')).toBeNull();
    expect(parseMapEvent('[{"type":"ready"}]')).toBeNull();
  });

  it('rejects unknown types', () => {
    expect(parse({ type: 'explode' })).toBeNull();
    expect(parse({})).toBeNull();
    expect(parse({ type: 7 })).toBeNull();
  });

  it('rejects a latitude out of range', () => {
    const bad = { ...REGION, center: { lat: 91, lng: 0 } };
    expect(parse({ type: 'region', region: bad })).toBeNull();
    const badBox = { ...REGION, bounds: { ...REGION.bounds, north: 90.5 } };
    expect(parse({ type: 'region', region: badBox })).toBeNull();
  });

  it('rejects a longitude out of range', () => {
    const bad = { ...REGION, bounds: { ...REGION.bounds, east: 181 } };
    expect(parse({ type: 'region', region: bad })).toBeNull();
    const badCentre = { ...REGION, center: { lat: 0, lng: -180.1 } };
    expect(parse({ type: 'region', region: badCentre })).toBeNull();
  });

  it('rejects a NaN or missing zoom (JSON turns NaN into null)', () => {
    expect(parseMapEvent('{"type":"region","region":{"bounds":{"west":-1,"south":-1,"east":1,"north":1},"center":{"lat":0,"lng":0},"zoom":null}}')).toBeNull();
    expect(parse({ type: 'region', region: { ...REGION, zoom: undefined } })).toBeNull();
    expect(parse({ type: 'region', region: { ...REGION, zoom: '12' } })).toBeNull();
  });

  it('rejects a region with a missing part', () => {
    expect(parse({ type: 'region' })).toBeNull();
    expect(parse({ type: 'region', region: { ...REGION, center: undefined } })).toBeNull();
    expect(parse({ type: 'region', region: { ...REGION, bounds: { west: 0 } } })).toBeNull();
  });

  it('rejects a numeric or missing pin id', () => {
    expect(parse({ type: 'pinPress', id: 7 })).toBeNull();
    expect(parse({ type: 'pinPress' })).toBeNull();
    expect(parse({ type: 'pinPress', id: null })).toBeNull();
  });

  it('rejects an error without a known reason', () => {
    expect(parse({ type: 'error' })).toBeNull();
    expect(parse({ type: 'error', reason: 'tiles' })).toBeNull();
  });
});

/** The JSON argument of `window.__fm.receive(<JSON>);true;`. */
function argumentOf(script: string): unknown {
  const prefix = 'window.__fm&&window.__fm.receive(';
  const suffix = ');true;';
  expect(script.startsWith(prefix)).toBe(true);
  expect(script.endsWith(suffix)).toBe(true);
  return JSON.parse(script.slice(prefix.length, script.length - suffix.length)) as unknown;
}

describe('commandScript', () => {
  const COMMANDS: MapCommand[] = [
    { type: 'setPins', pins: [{ id: 'a', lat: 49.28, lng: -123.12, tier: 'final', label: 'Marutama · 14 lists' }] },
    { type: 'select', id: 'a' },
    { type: 'select', id: null },
    { type: 'flyTo', camera: { lat: 49.28, lng: -123.12, zoom: 15 } },
    { type: 'fitPins', maxZoom: 14 },
    { type: 'setInsets', top: 90, bottom: 320 },
  ];

  it.each(COMMANDS)('round-trips %j', (cmd) => {
    expect(argumentOf(commandScript(cmd))).toEqual(cmd);
  });

  it('keeps a label with a quote, a backslash or </script> as data', () => {
    const label = 'Bob\'s "best" </script><script>alert(1)</script> \\ end';
    const cmd: MapCommand = {
      type: 'setPins',
      pins: [{ id: 'x', lat: 0, lng: 0, tier: 'honorable', label }],
    };
    const script = commandScript(cmd);
    expect(argumentOf(script)).toEqual(cmd);
    expect(script.toLowerCase()).not.toContain('</script');
    expect(script.split('\n')).toHaveLength(1);
  });

  it('escapes the line separators JSON allows but older engines do not', () => {
    const cmd: MapCommand = {
      type: 'setPins',
      pins: [{ id: 'x', lat: 0, lng: 0, tier: 'final', label: 'a\u2028b\u2029c' }],
    };
    const script = commandScript(cmd);
    expect(script).not.toContain('\u2028');
    expect(script).not.toContain('\u2029');
    expect(argumentOf(script)).toEqual(cmd);
  });
});
