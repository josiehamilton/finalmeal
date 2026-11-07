import { colors, map as mapTokens } from '@finalmeal/ui-tokens';
import { runMapPage } from '../test-support/fake-maplibre';
import type { FakeStyleLayer } from '../test-support/fake-maplibre';
import type { MapPin } from './bridge';
import {
  buildMapHtml,
  MAP_PAGE_SCRIPT,
  MAPLIBRE_GL_CSS_SRI,
  MAPLIBRE_GL_JS_SRI,
  MAPLIBRE_GL_VERSION,
  OPENFREEMAP_STYLE_URL,
} from './map-page';

const CAMERA = { lat: 49.2827, lng: -123.1207, zoom: 12 };

describe('buildMapHtml', () => {
  const html = buildMapHtml({ camera: CAMERA, interactive: true });

  it('pins an exact 5.x maplibre-gl in both CDN URLs, with integrity hashes', () => {
    expect(MAPLIBRE_GL_VERSION).toMatch(/^5\.\d+\.\d+$/);
    expect(html).toContain(`maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js`);
    expect(html).toContain(`maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css`);
    expect(MAPLIBRE_GL_JS_SRI).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
    expect(MAPLIBRE_GL_CSS_SRI).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
    expect(html).toContain(`integrity="${MAPLIBRE_GL_JS_SRI}" crossorigin="anonymous"`);
    expect(html).toContain(`integrity="${MAPLIBRE_GL_CSS_SRI}" crossorigin="anonymous"`);
  });

  it('reports a failed CDN load to the app', () => {
    expect(html).toMatch(/<script src="[^"]*maplibre-gl\.js"[^>]*onerror=/);
    expect(html).toMatch(/<link [^>]*maplibre-gl\.css"[^>]*onerror=/);
  });

  it('uses the OpenFreeMap dark style and never the phone’s position', () => {
    expect(OPENFREEMAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(html).toContain(OPENFREEMAP_STYLE_URL);
    expect(html).not.toMatch(/geolocation|GeolocateControl/i);
  });

  it('has a viewport that cannot be zoomed, a land-coloured page, and the camera inlined', () => {
    expect(html).toContain('user-scalable=no');
    expect(html).toContain(`background:${mapTokens.land}`);
    expect(html).toContain('<div id="map"></div>');
    expect(html).toContain('"zoom":12');
    expect(html).toContain(String(CAMERA.lat));
  });

  it('inlines the tokens as data, and the script is not cut short by a stray </script>', () => {
    expect(html).toContain(colors.ember);
    expect(html).toContain(mapTokens.roadMajor);
    expect(MAP_PAGE_SCRIPT.toLowerCase()).not.toContain('</script');
    expect(html.match(/<\/script>/g)).toHaveLength(3);
  });

  it('can be made non-interactive', () => {
    expect(buildMapHtml({ camera: CAMERA, interactive: false })).toContain('"interactive":false');
  });
});

describe('MAP_PAGE_SCRIPT', () => {
  const PINS: MapPin[] = [
    { id: 'a', lat: 49.28, lng: -123.12, tier: 'final', label: 'Marutama · 14 lists' },
    { id: 'b', lat: 49.26, lng: -123.1, tier: 'honorable', label: 'Skewers' },
  ];
  const LAYERS: FakeStyleLayer[] = [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill', 'source-layer': 'water' },
    { id: 'park-ish', type: 'fill', 'source-layer': 'park' },
    { id: 'wood', type: 'fill', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-pattern': 'wood-pattern' } },
    { id: 'ice', type: 'fill', 'source-layer': 'landcover', filter: ['==', ['get', 'subclass'], 'glacier'] },
    { id: 'minor', type: 'line', 'source-layer': 'transportation', filter: ['match', ['get', 'class'], ['minor', 'service']] },
    { id: 'big', type: 'line', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'motorway'] },
    { id: 'rivers', type: 'line', 'source-layer': 'waterway' },
    { id: 'names', type: 'symbol', 'source-layer': 'place' },
  ];

  const started = (opts: Parameters<typeof runMapPage>[0] = {}) => {
    const env = runMapPage({ layers: LAYERS, ...opts });
    return { env, map: env.map()! };
  };

  it('creates the map at the camera with a compact attribution, no rotation and nothing else', () => {
    const { map } = started();
    expect(map.options).toMatchObject({
      container: 'map',
      style: OPENFREEMAP_STYLE_URL,
      center: [CAMERA.lng, CAMERA.lat],
      zoom: CAMERA.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      interactive: true,
    });
  });

  it('posts ready after the map’s load, then its first region', () => {
    const { env, map } = started();
    expect(env.posted).toEqual([]);
    map.fire('load');
    expect(env.posted.map((e) => e.type)).toEqual(['ready', 'region']);
  });

  it('recolours the style by layer type and source-layer', () => {
    const { map } = started();
    map.fire('style.load');
    expect(map.paints.background).toEqual({ 'background-color': '#141210' });
    expect(map.paints.water).toEqual({ 'fill-color': '#0F1A1F' });
    expect(map.paints['park-ish']?.['fill-color']).toBe(mapTokens.park);
    expect(map.paints.wood).toEqual({ 'fill-color': mapTokens.park, 'fill-opacity': 1, 'fill-pattern': null });
    expect(map.paints.ice).toBeUndefined();
    expect(map.paints.minor).toEqual({ 'line-color': mapTokens.road });
    expect(map.paints.big).toEqual({ 'line-color': mapTokens.roadMajor });
    expect(map.paints.rivers).toBeUndefined();
    expect(map.paints.names).toEqual({
      'text-color': mapTokens.label,
      'text-halo-color': mapTokens.labelHalo,
    });
  });

  it('adds a marker per pin and diffs a second setPins by id', () => {
    const { env } = started();
    env.receive({ type: 'setPins', pins: PINS });
    expect(env.liveMarkers()).toHaveLength(2);
    expect(env.markers[0]?.lngLat).toEqual([-123.12, 49.28]);
    expect(env.markers[0]?.options.anchor).toBe('center');
    env.receive({ type: 'setPins', pins: [PINS[0]!] });
    expect(env.markers).toHaveLength(2);
    expect(env.markers[0]?.removed).toBe(false);
    expect(env.markers[1]?.removed).toBe(true);
  });

  it('keeps a marker whose pin is unchanged and moves one whose point changed', () => {
    const { env } = started();
    env.receive({ type: 'setPins', pins: PINS });
    env.receive({ type: 'setPins', pins: [{ ...PINS[0]!, lat: 49.3 }, PINS[1]!] });
    expect(env.markers).toHaveLength(2);
    expect(env.markers[0]?.lngLat).toEqual([-123.12, 49.3]);
  });

  it('rebuilds a marker whose tier changed', () => {
    const { env } = started();
    env.receive({ type: 'setPins', pins: PINS });
    env.receive({ type: 'setPins', pins: [{ ...PINS[0]!, tier: 'honorable' }, PINS[1]!] });
    expect(env.markers).toHaveLength(3);
    expect(env.markers[0]?.removed).toBe(true);
    expect(env.liveMarkers()[1]?.element.style.width).toBe('18px');
  });

  it('draws a Final pin as a 38 px ember disc with a white skull, and an Honorable one as an 18 px bone dot', () => {
    const { env } = started();
    env.receive({ type: 'setPins', pins: PINS });
    const [final, honorable] = env.markers.map((m) => m.element);
    expect(final?.style).toMatchObject({
      width: '38px',
      height: '38px',
      background: colors.ember,
      border: `2px solid ${colors.night}`,
      boxShadow: 'none',
    });
    expect(final?.attributes['aria-label']).toBe('Final Meal pick');
    const path = final?.children[0]?.children[0];
    expect(path?.attributes.fill).toBe(colors.white);
    expect(path?.attributes.d?.startsWith('M 1.225')).toBe(true);
    expect(honorable?.style).toMatchObject({
      width: '18px',
      height: '18px',
      background: colors.honorable,
      border: `3px solid ${colors.night}`,
    });
    expect(honorable?.attributes['aria-label']).toBe('Honorable Mention pick');
    expect(honorable?.children).toHaveLength(0);
  });

  it('makes the selected pin bigger with its ring and a callout, and puts the others back', () => {
    const { env } = started();
    env.receive({ type: 'setPins', pins: PINS });
    env.receive({ type: 'select', id: 'a' });
    const [a, b] = env.markers.map((m) => m.element);
    expect(a?.style.width).toBe('44px');
    expect(a?.style.boxShadow).toBe(`0 0 0 4px ${colors.emberRing}`);
    expect(a?.attributes['aria-label']).toBe('Final Meal pick, selected');
    const callout = a?.children.find((c) => c.tag === 'div');
    expect(callout?.textContent).toBe('Marutama · 14 lists');
    expect(callout?.style).toMatchObject({
      background: colors.bone,
      color: colors.night,
      fontSize: '12px',
      fontWeight: '700',
      borderRadius: '10px',
      padding: '6px 10px',
    });
    expect(b?.style.width).toBe('18px');

    env.receive({ type: 'select', id: 'b' });
    expect(a?.style.width).toBe('38px');
    expect(a?.children.some((c) => c.tag === 'div')).toBe(false);
    expect(b?.style.width).toBe('26px');
    expect(b?.style.boxShadow).toBe(`0 0 0 5px ${colors.honorableRing}`);
    expect(b?.attributes['aria-label']).toBe('Honorable Mention pick, selected');
    expect(b?.children[0]?.textContent).toBe('Skewers');

    env.receive({ type: 'select', id: null });
    expect(b?.style.width).toBe('18px');
  });

  it('applies a selection that arrives before its pin', () => {
    const { env } = started();
    env.receive({ type: 'select', id: 'a' });
    env.receive({ type: 'setPins', pins: PINS });
    expect(env.markers[0]?.element.style.width).toBe('44px');
  });

  it('shows a callout as text, never as markup', () => {
    const { env } = started();
    env.receive({
      type: 'setPins',
      pins: [{ ...PINS[0]!, label: '<img src=x onerror=alert(1)>' }],
    });
    env.receive({ type: 'select', id: 'a' });
    const callout = env.markers[0]?.element.children.find((c) => c.tag === 'div');
    expect(callout?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(callout?.children).toHaveLength(0);
  });

  it('posts pinPress for a marker tap, stops it, and posts no mapPress', () => {
    const { env } = started();
    env.receive({ type: 'setPins', pins: PINS });
    env.tapMarker(env.markers[1]!);
    expect(env.posted).toEqual([{ type: 'pinPress', id: 'b' }]);
  });

  it('posts mapPress for a tap on the bare map', () => {
    const { env } = started();
    env.tapMap();
    expect(env.posted).toEqual([{ type: 'mapPress' }]);
  });

  it('posts a region on moveend with the map’s bounds, centre and zoom', () => {
    const { env, map } = started();
    map.fire('load');
    env.posted.length = 0;
    map.bounds = { west: -123.2, south: 49.2, east: -123.0, north: 49.3 };
    map.center = { lat: 49.25, lng: -123.1 };
    map.zoom = 13.2;
    map.fire('moveend');
    expect(env.posted).toEqual([
      {
        type: 'region',
        region: {
          bounds: { west: -123.2, south: 49.2, east: -123, north: 49.3 },
          center: { lat: 49.25, lng: -123.1 },
          zoom: 13.2,
        },
      },
    ]);
  });

  it('normalises the box: across the antimeridian west is greater than east, a whole world is -180..180', () => {
    const { env, map } = started();
    map.fire('load');
    env.posted.length = 0;
    map.bounds = { west: 170, south: -20, east: 185, north: -10 };
    map.center = { lat: -15, lng: 177.5 };
    map.fire('moveend');
    map.bounds = { west: -400, south: -95, east: 400, north: 95 };
    map.center = { lat: 0, lng: 190 };
    map.fire('moveend');
    const regions = env.posted.map((e) => e.region as { bounds: unknown; center: unknown });
    expect(regions[0]?.bounds).toEqual({ west: 170, south: -20, east: -175, north: -10 });
    expect(regions[1]?.bounds).toEqual({ west: -180, south: -90, east: 180, north: 90 });
    expect(regions[1]?.center).toEqual({ lat: 0, lng: -170 });
  });

  it('flies to a camera', () => {
    const { env, map } = started();
    env.receive({ type: 'flyTo', camera: { lat: 49.28, lng: -123.12, zoom: 15 } });
    expect(map.lastCall('flyTo')?.args[0]).toMatchObject({ center: [-123.12, 49.28], zoom: 15 });
  });

  it('fits several pins within maxZoom, centres on one, and does nothing for none', () => {
    const { env, map } = started();
    env.receive({ type: 'fitPins', maxZoom: 14 });
    expect(map.calls.filter((c) => c.method === 'fitBounds' || c.method === 'easeTo')).toEqual([]);

    env.receive({ type: 'setPins', pins: [PINS[0]!] });
    env.receive({ type: 'fitPins', maxZoom: 14 });
    expect(map.lastCall('easeTo')?.args[0]).toMatchObject({ center: [-123.12, 49.28], zoom: 14 });

    env.receive({ type: 'setPins', pins: PINS });
    env.receive({ type: 'fitPins', maxZoom: 14 });
    const [box, options] = map.lastCall('fitBounds')!.args;
    expect(box).toEqual([
      [-123.12, 49.26],
      [-123.1, 49.28],
    ]);
    expect(options).toMatchObject({ maxZoom: 14 });
  });

  it('pads the map for the sheet and lifts the attribution above it', () => {
    const { env, map } = started();
    env.receive({ type: 'setInsets', top: 96, bottom: 320 });
    expect(map.lastCall('setPadding')?.args[0]).toEqual({ top: 96, bottom: 320, left: 0, right: 0 });
    expect(env.attribution.style.bottom).toBe('320px');
  });

  it('ignores a command it does not know', () => {
    const { env } = started();
    expect(() => (env.receive as (c: unknown) => void)({ type: 'bogus' })).not.toThrow();
    expect(() => (env.receive as (c: unknown) => void)({ type: 'setPins' })).not.toThrow();
  });

  it('posts a style error only when the style fails before it has loaded', () => {
    const { env, map } = started();
    map.fire('error');
    map.fire('error');
    expect(env.posted).toEqual([{ type: 'error', reason: 'style' }]);

    const later = started();
    later.map.fire('style.load');
    later.map.fire('error');
    expect(later.env.posted).toEqual([]);
  });

  it('posts error/load when maplibregl is missing', () => {
    const env = runMapPage({ maplibre: false });
    expect(env.posted).toEqual([{ type: 'error', reason: 'load' }]);
    expect(() => env.receive({ type: 'select', id: 'a' })).not.toThrow();
  });

  it('posts error/load when the map cannot start (no WebGL)', () => {
    const env = runMapPage({ webglFails: true });
    expect(env.posted).toEqual([{ type: 'error', reason: 'load' }]);
    expect(() => env.receive({ type: 'setPins', pins: PINS })).not.toThrow();
  });

  it('never touches the phone’s position', () => {
    expect(MAP_PAGE_SCRIPT).not.toMatch(/geolocation|GeolocateControl/i);
  });
});
