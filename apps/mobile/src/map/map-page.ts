import { colors, map as mapTokens, skull } from '@finalmeal/ui-tokens';
import type { MapCamera } from './bridge';

/** The maplibre-gl build the page loads from jsDelivr. Bump it with its two hashes below. */
export const MAPLIBRE_GL_VERSION = '5.24.0';
export const MAPLIBRE_GL_JS_URL = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js`;
export const MAPLIBRE_GL_CSS_URL = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css`;
/** `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`, prefixed with `sha384-`. */
export const MAPLIBRE_GL_JS_SRI =
  'sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp';
export const MAPLIBRE_GL_CSS_SRI =
  'sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK';

export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** How long the page waits for the map's first `load` before it reports `error`/`load`. */
export const MAP_LOAD_TIMEOUT_MS = 20_000;

/**
 * The page's program: plain ES2017 in a string, because `Function.toString` is stripped by Hermes.
 * It reads `window.FM_CONFIG` (colours, camera, style URL: see `buildMapHtml`) and the global
 * `maplibregl`, talks to the app through `window.ReactNativeWebView.postMessage` (events) and
 * `window.__fm.receive` (commands). It never touches the phone's position. The shapes it sends
 * and accepts are `MapEvent` and `MapCommand` in `bridge.ts`.
 */
export const MAP_PAGE_SCRIPT: string = String.raw`
(function () {
  'use strict';
  var cfg = window.FM_CONFIG;
  var C = cfg.colors;
  var M = cfg.map;
  var SKULL = cfg.skull;
  var failed = {};
  var map = null;
  var entries = {};
  var pinsById = {};
  var selectedId = null;
  var ready = false;
  var styleLoaded = false;

  function post(event) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(event));
    } catch (e) {
      /* not inside the app's WebView */
    }
  }

  function fail(reason) {
    if (failed[reason] || (reason === 'load' && window.__fmLoadFailed)) return;
    failed[reason] = true;
    post({ type: 'error', reason: reason });
  }

  /* Styling: recolour the OpenFreeMap dark style to the canvas palette, by layer type and source-layer. */
  function paint(id, prop, value) {
    map.setPaintProperty(id, prop, value);
  }

  function recolourLayer(layer) {
    var source = layer['source-layer'];
    var filter = JSON.stringify(layer.filter || '');
    var existing = layer.paint || {};
    if (layer.type === 'background') {
      paint(layer.id, 'background-color', M.land);
    } else if (layer.type === 'fill') {
      if (source === 'water') {
        paint(layer.id, 'fill-color', M.water);
      } else if (
        source === 'park' ||
        (source === 'landcover' && /wood|grass/.test(filter)) ||
        (source === 'landuse' && /park/.test(filter))
      ) {
        paint(layer.id, 'fill-color', M.park);
        paint(layer.id, 'fill-opacity', 1);
        if (existing['fill-pattern']) paint(layer.id, 'fill-pattern', null);
      }
    } else if (layer.type === 'line' && source === 'transportation') {
      paint(layer.id, 'line-color', /motorway|trunk|primary/.test(filter) ? M.roadMajor : M.road);
    } else if (layer.type === 'symbol') {
      paint(layer.id, 'text-color', M.label);
      paint(layer.id, 'text-halo-color', M.labelHalo);
    }
  }

  function recolour() {
    var style = map.getStyle();
    if (!style || !style.layers) return;
    style.layers.forEach(function (layer) {
      try {
        recolourLayer(layer);
      } catch (e) {
        /* a layer the style no longer has: leave it as it is */
      }
    });
  }

  /* Pins: HTML markers, so the skull and the rings are drawn exactly as on the canvas. */
  function skullSvg(height) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    var parts = SKULL.viewBox.split(' ');
    svg.setAttribute('viewBox', SKULL.viewBox);
    svg.setAttribute('width', String((height * Number(parts[2])) / Number(parts[3])));
    svg.setAttribute('height', String(height));
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', SKULL.path);
    path.setAttribute('fill', C.white);
    svg.appendChild(path);
    return svg;
  }

  function styleEntry(entry) {
    var pin = entry.pin;
    var el = entry.element;
    var selected = pin.id === selectedId;
    var final = pin.tier === 'final';
    var size = final ? (selected ? 44 : 38) : selected ? 26 : 18;
    var ring = selected ? '0 0 0 ' + (final ? 4 : 5) + 'px ' + (final ? C.emberRing : C.honorableRing) : 'none';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.boxShadow = ring;
    el.style.zIndex = selected ? '3' : final ? '2' : '1';
    el.setAttribute(
      'aria-label',
      (final ? 'Final Meal pick' : 'Honorable Mention pick') + (selected ? ', selected' : ''),
    );
    while (el.firstChild) el.removeChild(el.firstChild);
    if (final) el.appendChild(skullSvg(Math.round(size * 0.52)));
    entry.callout = null;
    if (selected) {
      var callout = document.createElement('div');
      callout.textContent = pin.label;
      callout.style.position = 'absolute';
      callout.style.top = '100%';
      callout.style.left = '50%';
      callout.style.transform = 'translateX(-50%)';
      callout.style.marginTop = '8px';
      callout.style.padding = '6px 10px';
      callout.style.borderRadius = '10px';
      callout.style.background = C.bone;
      callout.style.color = C.night;
      callout.style.fontFamily = 'system-ui, -apple-system, Roboto, sans-serif';
      callout.style.fontSize = '12px';
      callout.style.fontWeight = '700';
      callout.style.lineHeight = '1.3';
      callout.style.whiteSpace = 'nowrap';
      callout.style.maxWidth = '220px';
      callout.style.overflow = 'hidden';
      callout.style.textOverflow = 'ellipsis';
      callout.style.pointerEvents = 'none';
      el.appendChild(callout);
      entry.callout = callout;
    }
  }

  function buildElement(pin) {
    var final = pin.tier === 'final';
    var el = document.createElement('div');
    el.setAttribute('role', 'button');
    el.style.boxSizing = 'border-box';
    el.style.borderRadius = '50%';
    el.style.border = (final ? 2 : 3) + 'px solid ' + C.night;
    el.style.background = final ? C.ember : C.honorable;
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.cursor = 'pointer';
    el.style.touchAction = 'manipulation';
    el.addEventListener('click', function (event) {
      event.stopPropagation();
      post({ type: 'pinPress', id: pin.id });
    });
    return el;
  }

  function addEntry(pin) {
    var entry = { pin: pin, element: buildElement(pin), callout: null, marker: null };
    styleEntry(entry);
    entry.marker = new maplibregl.Marker({ element: entry.element, anchor: 'center' })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
    entries[pin.id] = entry;
  }

  function removeEntry(id) {
    entries[id].marker.remove();
    delete entries[id];
  }

  function validPin(pin) {
    return (
      pin &&
      typeof pin.id === 'string' &&
      (pin.tier === 'final' || pin.tier === 'honorable') &&
      typeof pin.label === 'string' &&
      typeof pin.lat === 'number' &&
      isFinite(pin.lat) &&
      typeof pin.lng === 'number' &&
      isFinite(pin.lng)
    );
  }

  function setPins(all) {
    var pins = all.filter(validPin);
    var next = {};
    pins.forEach(function (pin) {
      next[pin.id] = pin;
    });
    Object.keys(entries).forEach(function (id) {
      var old = entries[id].pin;
      var pin = next[id];
      if (!pin || pin.tier !== old.tier) removeEntry(id);
    });
    pins.forEach(function (pin) {
      var entry = entries[pin.id];
      if (!entry) {
        addEntry(pin);
        return;
      }
      if (entry.pin.lat !== pin.lat || entry.pin.lng !== pin.lng) {
        entry.marker.setLngLat([pin.lng, pin.lat]);
      }
      if (entry.pin.label !== pin.label) {
        entry.pin = pin;
        styleEntry(entry);
      } else {
        entry.pin = pin;
      }
    });
    pinsById = next;
  }

  function select(id) {
    var previous = selectedId;
    selectedId = id;
    [previous, id].forEach(function (key) {
      if (key !== null && entries[key]) styleEntry(entries[key]);
    });
  }

  function fitPins(maxZoom) {
    var pins = Object.keys(pinsById).map(function (id) {
      return pinsById[id];
    });
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: maxZoom });
      return;
    }
    var south = 90;
    var north = -90;
    var lngs = [];
    pins.forEach(function (pin) {
      south = Math.min(south, pin.lat);
      north = Math.max(north, pin.lat);
      lngs.push(pin.lng);
    });
    lngs.sort(function (x, y) {
      return x - y;
    });
    /* The box leaves out the widest empty stretch of longitude, so pins either side of 180 fit the short way round. */
    var west = lngs[0];
    var east = lngs[lngs.length - 1];
    var widestGap = 360 - (east - west);
    for (var i = 0; i < lngs.length - 1; i += 1) {
      if (lngs[i + 1] - lngs[i] > widestGap) {
        widestGap = lngs[i + 1] - lngs[i];
        west = lngs[i + 1];
        east = lngs[i] + 360;
      }
    }
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 56, maxZoom: maxZoom },
    );
  }

  function setInsets(top, bottom) {
    map.setPadding({ top: top, bottom: bottom, left: 0, right: 0 });
    var attribution = document.querySelector('.maplibregl-ctrl-bottom-right');
    if (attribution) attribution.style.bottom = bottom + 'px';
  }

  function receive(cmd) {
    if (!map || !cmd) return;
    try {
      if (cmd.type === 'setPins') setPins(cmd.pins);
      else if (cmd.type === 'select') select(cmd.id);
      else if (cmd.type === 'flyTo') {
        map.flyTo({
          center: [cmd.camera.lng, cmd.camera.lat],
          zoom: cmd.camera.zoom,
          essential: true,
        });
      } else if (cmd.type === 'fitPins') fitPins(cmd.maxZoom);
      else if (cmd.type === 'setInsets') setInsets(cmd.top, cmd.bottom);
    } catch (e) {
      /* a bad command must not break the page */
    }
  }

  /* Regions: wrapped into -180..180; a box across the antimeridian has west > east. */
  function wrap(lng) {
    return lng >= -180 && lng <= 180 ? lng : ((((lng + 180) % 360) + 360) % 360) - 180;
  }

  function clampLat(lat) {
    return Math.max(-90, Math.min(90, lat));
  }

  function postRegion() {
    var bounds = map.getBounds();
    var center = map.getCenter();
    var west = bounds.getWest();
    var east = bounds.getEast();
    if (east - west >= 360) {
      west = -180;
      east = 180;
    } else {
      west = wrap(west);
      east = wrap(east);
    }
    post({
      type: 'region',
      region: {
        bounds: { west: west, south: clampLat(bounds.getSouth()), east: east, north: clampLat(bounds.getNorth()) },
        center: { lat: clampLat(center.lat), lng: wrap(center.lng) },
        zoom: map.getZoom(),
      },
    });
  }

  function start() {
    if (typeof maplibregl === 'undefined') {
      fail('load');
      return;
    }
    try {
      map = new maplibregl.Map({
        container: 'map',
        style: cfg.styleUrl,
        center: [cfg.camera.lng, cfg.camera.lat],
        zoom: cfg.camera.zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        interactive: cfg.interactive,
      });
    } catch (e) {
      map = null;
      fail('load');
      return;
    }
    if (map.touchZoomRotate && map.touchZoomRotate.disableRotation) map.touchZoomRotate.disableRotation();
    var loadTimer = window.setTimeout(function () {
      if (!ready) fail('load');
    }, cfg.loadTimeoutMs);
    map.on('style.load', function () {
      styleLoaded = true;
      recolour();
    });
    map.on('load', function () {
      window.clearTimeout(loadTimer);
      ready = true;
      post({ type: 'ready' });
      postRegion();
    });
    map.on('moveend', function () {
      if (ready) postRegion();
    });
    map.on('click', function () {
      post({ type: 'mapPress' });
    });
    map.on('webglcontextlost', function () {
      fail('load');
    });
    map.on('error', function () {
      /* tile errors after the style is in are the tile server's business; before it, the style failed */
      if (!styleLoaded) fail('style');
    });
  }

  window.__fm = { receive: receive };
  start();
})();
`;

export interface MapPageOptions {
  camera: MapCamera;
  interactive: boolean;
}

/** JSON that is safe inside a <script> element: no `</script>`, no U+2028/U+2029. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** What the page script reads from `window.FM_CONFIG`: the tokens, the camera and the style URL. */
export function mapPageConfig(opts: MapPageOptions) {
  return {
    styleUrl: OPENFREEMAP_STYLE_URL,
    camera: opts.camera,
    interactive: opts.interactive,
    loadTimeoutMs: MAP_LOAD_TIMEOUT_MS,
    map: mapTokens,
    colors: {
      night: colors.night,
      bone: colors.bone,
      ember: colors.ember,
      honorable: colors.honorable,
      white: colors.white,
      emberRing: colors.emberRing,
      honorableRing: colors.honorableRing,
    },
    skull: { path: skull.path, viewBox: skull.viewBox },
  };
}

/** The whole document for the WebView: the pinned maplibre-gl tags, the tokens and the camera inlined. */
export function buildMapHtml(opts: MapPageOptions): string {
  const config = mapPageConfig(opts);
  const failScript =
    "window.fmFail=function(){window.__fmLoadFailed=true;try{window.ReactNativeWebView.postMessage('{\"type\":\"error\",\"reason\":\"load\"}')}catch(e){}};";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${mapTokens.land};-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
#map{position:absolute;top:0;right:0;bottom:0;left:0;background:${mapTokens.land}}
.maplibregl-canvas{outline:none}
.maplibregl-ctrl-attrib.maplibregl-compact,.maplibregl-ctrl-attrib{background:${colors.glass};color:${colors.smoke}}
.maplibregl-ctrl-attrib a{color:${colors.smoke}}
.maplibregl-ctrl-attrib-button{background-color:transparent;filter:invert(1)}
</style>
<script>window.FM_CONFIG=${scriptJson(config)};${failScript}</script>
<link rel="stylesheet" href="${MAPLIBRE_GL_CSS_URL}" integrity="${MAPLIBRE_GL_CSS_SRI}" crossorigin="anonymous" onerror="window.fmFail()">
<script src="${MAPLIBRE_GL_JS_URL}" integrity="${MAPLIBRE_GL_JS_SRI}" crossorigin="anonymous" onerror="window.fmFail()"></script>
</head>
<body>
<div id="map"></div>
<script>${MAP_PAGE_SCRIPT}</script>
</body>
</html>`;
}
