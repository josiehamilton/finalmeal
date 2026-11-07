import type { MapCommand } from '../map/bridge';
import { MAP_PAGE_SCRIPT, mapPageConfig } from '../map/map-page';

/** A fake `maplibregl` and just enough DOM to run the map page's script in Node. */

type Handler = (event?: unknown) => void;

export class FakeElement {
  readonly style: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  children: FakeElement[] = [];
  textContent = '';
  private listeners: Record<string, Handler[]> = {};

  constructor(readonly tag: string) {}

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeElement) {
    this.children = this.children.filter((c) => c !== child);
    return child;
  }

  addEventListener(type: string, handler: Handler) {
    (this.listeners[type] ??= []).push(handler);
  }

  /** Dispatches a DOM event; returns whether a listener stopped its propagation. */
  dispatch(type: string): { stopped: boolean } {
    const result = { stopped: false };
    const event = {
      stopPropagation: () => {
        result.stopped = true;
      },
    };
    for (const handler of this.listeners[type] ?? []) handler(event);
    return result;
  }
}

export interface FakeStyleLayer {
  id: string;
  type: 'background' | 'fill' | 'line' | 'symbol';
  'source-layer'?: string;
  filter?: unknown;
  paint?: Record<string, unknown>;
}

export class FakeMarker {
  lngLat: [number, number] | null = null;
  removed = false;
  constructor(readonly options: { element: FakeElement; anchor?: string }) {}
  get element(): FakeElement {
    return this.options.element;
  }
  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }
  addTo() {
    return this;
  }
  remove() {
    this.removed = true;
    return this;
  }
}

export interface FakeBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export class FakeMap {
  options: Record<string, unknown>;
  handlers: Record<string, Handler[]> = {};
  paints: Record<string, Record<string, unknown>> = {};
  calls: Array<{ method: string; args: unknown[] }> = [];
  bounds: FakeBounds = { west: -123.2, south: 49.2, east: -123.0, north: 49.3 };
  center = { lat: 49.25, lng: -123.1 };
  zoom = 12;
  touchZoomRotate = { disableRotation: () => {} };

  constructor(
    options: Record<string, unknown>,
    private layers: FakeStyleLayer[],
  ) {
    this.options = options;
  }

  on(type: string, handler: Handler) {
    (this.handlers[type] ??= []).push(handler);
  }

  fire(type: string) {
    for (const handler of this.handlers[type] ?? []) handler();
  }

  getStyle() {
    return { layers: this.layers };
  }

  setPaintProperty(id: string, prop: string, value: unknown) {
    (this.paints[id] ??= {})[prop] = value;
  }

  getBounds() {
    const b = this.bounds;
    return {
      getWest: () => b.west,
      getSouth: () => b.south,
      getEast: () => b.east,
      getNorth: () => b.north,
    };
  }

  getCenter() {
    return this.center;
  }

  getZoom() {
    return this.zoom;
  }

  private record(method: string, args: unknown[]) {
    this.calls.push({ method, args });
  }

  flyTo(...args: unknown[]) {
    this.record('flyTo', args);
  }

  easeTo(...args: unknown[]) {
    this.record('easeTo', args);
  }

  fitBounds(...args: unknown[]) {
    this.record('fitBounds', args);
  }

  setPadding(...args: unknown[]) {
    this.record('setPadding', args);
  }

  lastCall(method: string) {
    return [...this.calls].reverse().find((c) => c.method === method);
  }
}

export interface MapPageEnv {
  /** Everything the page posted to the app, parsed. */
  posted: Array<Record<string, unknown>>;
  /** Every marker the page created, in order (removed ones stay, with `removed` set). */
  markers: FakeMarker[];
  /** The live markers, in creation order. */
  liveMarkers(): FakeMarker[];
  /** The map the page created; null when maplibre was missing or the map failed to start. */
  map: () => FakeMap | null;
  /** The element the page lifted above the sheet (the attribution control's corner). */
  attribution: FakeElement;
  /** Sends a command the way `commandScript` does. */
  receive(cmd: MapCommand): void;
  /** A tap on a marker: the DOM click, then the map's own click if nothing stopped it. */
  tapMarker(marker: FakeMarker): void;
  /** A tap on the bare map. */
  tapMap(): void;
}

export interface MapPageEnvOptions {
  /** `false` runs the page with no `maplibregl` global at all. */
  maplibre?: boolean;
  /** `Map` throws, as it does without WebGL. */
  webglFails?: boolean;
  layers?: FakeStyleLayer[];
  /** Overrides the default config (Vancouver, interactive). */
  config?: ReturnType<typeof mapPageConfig>;
}

/** Runs `MAP_PAGE_SCRIPT` against the fakes. */
export function runMapPage(opts: MapPageEnvOptions = {}): MapPageEnv {
  const posted: Array<Record<string, unknown>> = [];
  const markers: FakeMarker[] = [];
  const attribution = new FakeElement('div');
  let created: FakeMap | null = null;
  const layers = opts.layers ?? [];

  const win: Record<string, unknown> = {
    FM_CONFIG:
      opts.config ??
      mapPageConfig({ camera: { lat: 49.2827, lng: -123.1207, zoom: 12 }, interactive: true }),
    ReactNativeWebView: {
      postMessage: (data: string) => posted.push(JSON.parse(data) as Record<string, unknown>),
    },
  };
  const doc = {
    createElement: (tag: string) => new FakeElement(tag),
    createElementNS: (_ns: string, tag: string) => new FakeElement(tag),
    querySelector: (selector: string) =>
      selector === '.maplibregl-ctrl-bottom-right' ? attribution : null,
  };
  const maplibregl =
    opts.maplibre === false
      ? undefined
      : {
          Map: function (options: Record<string, unknown>) {
            if (opts.webglFails) throw new Error('Failed to initialize WebGL');
            created = new FakeMap(options, layers);
            return created;
          },
          Marker: function (options: { element: FakeElement; anchor?: string }) {
            const marker = new FakeMarker(options);
            markers.push(marker);
            return marker;
          },
        };

  new Function('window', 'document', 'maplibregl', MAP_PAGE_SCRIPT)(win, doc, maplibregl);

  const receive = (cmd: MapCommand) => {
    (win.__fm as { receive(c: MapCommand): void }).receive(JSON.parse(JSON.stringify(cmd)));
  };
  return {
    posted,
    markers,
    liveMarkers: () => markers.filter((m) => !m.removed),
    map: () => created,
    attribution,
    receive,
    tapMarker(marker) {
      const { stopped } = marker.element.dispatch('click');
      if (!stopped) created?.fire('click');
    },
    tapMap() {
      created?.fire('click');
    },
  };
}
