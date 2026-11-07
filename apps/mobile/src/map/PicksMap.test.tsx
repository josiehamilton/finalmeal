import { createRef } from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  currentWebView,
  emitMapEvent,
  emitRawMapMessage,
  resetMapMock,
  sentCommands,
  webViewMounts,
} from '../test-support/map';
import type { MapPin, MapRegion } from './bridge';
import { PicksMap } from './PicksMap';
import type { PicksMapHandle, PicksMapProps } from './PicksMap';

const CAMERA = { lat: 49.28, lng: -123.12, zoom: 12 };
const PINS: MapPin[] = [
  { id: 'a', lat: 49.28, lng: -123.12, tier: 'final', label: 'Marutama · 14 lists' },
  { id: 'b', lat: 49.26, lng: -123.1, tier: 'honorable', label: 'Skewers' },
];
const REGION: MapRegion = {
  bounds: { west: -123.2, south: 49.2, east: -123, north: 49.3 },
  center: { lat: 49.25, lng: -123.1 },
  zoom: 13,
};

async function setup(overrides: Partial<PicksMapProps> = {}) {
  const props: PicksMapProps = { initialCamera: CAMERA, pins: PINS, selectedId: null, ...overrides };
  const view = await render(<PicksMap {...props} />);
  return { props, ...view };
}

beforeEach(() => {
  resetMapMock();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('PicksMap', () => {
  it('loads the map page into one WebView, with no location and its links kept out of it', async () => {
    await setup();
    const webview = currentWebView() as Record<string, unknown>;
    expect((webview.source as { html: string }).html).toContain('<div id="map"></div>');
    expect(webview.originWhitelist).toEqual(['*']);
    expect(webview.geolocationEnabled).toBe(false);
    expect(webview.setSupportMultipleWindows).toBe(false);
    expect(webViewMounts()).toBe(1);
  });

  it('shows a placeholder until the page is ready', async () => {
    await setup();
    expect(screen.getByTestId('map-loading')).toBeTruthy();
    await emitMapEvent({ type: 'ready' });
    expect(screen.queryByTestId('map-loading')).toBeNull();
  });

  it('queues commands sent before ready and sends them in order once it is', async () => {
    await setup({ insets: { top: 90, bottom: 300 }, selectedId: 'a' });
    expect(sentCommands()).toEqual([]);
    await emitMapEvent({ type: 'ready' });
    expect(sentCommands()).toEqual([
      { type: 'setInsets', top: 90, bottom: 300 },
      { type: 'setPins', pins: PINS },
      { type: 'select', id: 'a' },
    ]);
  });

  it('sends only the latest pins and selection that were waiting', async () => {
    const { rerender, props } = await setup();
    await rerender(<PicksMap {...props} pins={[PINS[0]!]} selectedId="a" />);
    await rerender(<PicksMap {...props} pins={[PINS[1]!]} selectedId="b" />);
    await emitMapEvent({ type: 'ready' });
    expect(sentCommands()).toEqual([
      { type: 'setPins', pins: [PINS[1]] },
      { type: 'select', id: 'b' },
    ]);
  });

  it('re-sends pins, selection and insets when they change after ready', async () => {
    const { rerender, props } = await setup();
    await emitMapEvent({ type: 'ready' });
    const before = sentCommands().length;
    await rerender(<PicksMap {...props} pins={[PINS[0]!]} selectedId="a" insets={{ top: 10, bottom: 200 }} />);
    expect(sentCommands().slice(before)).toEqual([
      { type: 'setInsets', top: 10, bottom: 200 },
      { type: 'setPins', pins: [PINS[0]] },
      { type: 'select', id: 'a' },
    ]);
  });

  it('flies to a camera through its handle, queued until ready', async () => {
    const ref = createRef<PicksMapHandle>();
    await render(<PicksMap ref={ref} initialCamera={CAMERA} pins={[]} selectedId={null} />);
    await act(async () => ref.current?.flyTo({ lat: 1, lng: 2, zoom: 15 }));
    expect(sentCommands()).toEqual([]);
    await emitMapEvent({ type: 'ready' });
    expect(sentCommands()).toContainEqual({ type: 'flyTo', camera: { lat: 1, lng: 2, zoom: 15 } });
    await act(async () => ref.current?.flyTo({ lat: 3, lng: 4, zoom: 12 }));
    expect(sentCommands().at(-1)).toEqual({ type: 'flyTo', camera: { lat: 3, lng: 4, zoom: 12 } });
  });

  it('passes a region on to onRegionChange', async () => {
    const onRegionChange = jest.fn();
    await setup({ onRegionChange });
    await emitMapEvent({ type: 'region', region: REGION });
    expect(onRegionChange).toHaveBeenCalledWith(REGION);
  });

  it('calls onPinPress for a pin it has, and ignores one it does not', async () => {
    const onPinPress = jest.fn();
    await setup({ onPinPress });
    await emitMapEvent({ type: 'pinPress', id: 'b' });
    expect(onPinPress).toHaveBeenCalledWith('b');
    onPinPress.mockClear();
    await emitMapEvent({ type: 'pinPress', id: 'ghost' });
    expect(onPinPress).not.toHaveBeenCalled();
  });

  it('calls onMapPress for a bare-map tap', async () => {
    const onMapPress = jest.fn();
    await setup({ onMapPress });
    await emitMapEvent({ type: 'mapPress' });
    expect(onMapPress).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown and malformed messages', async () => {
    const handlers = { onRegionChange: jest.fn(), onPinPress: jest.fn(), onMapPress: jest.fn() };
    await setup(handlers);
    await emitRawMapMessage('not json');
    await emitRawMapMessage('{"type":"explode"}');
    await emitRawMapMessage('{"type":"pinPress","id":7}');
    await emitRawMapMessage('{"type":"region","region":{"bounds":{"west":0,"south":95,"east":1,"north":96},"center":{"lat":0,"lng":0},"zoom":3}}');
    expect(handlers.onRegionChange).not.toHaveBeenCalled();
    expect(handlers.onPinPress).not.toHaveBeenCalled();
    expect(handlers.onMapPress).not.toHaveBeenCalled();
    expect(screen.queryByTestId('map-error')).toBeNull();
  });

  it('says the map did not load, and Try again remounts it where it was looking', async () => {
    const { props, rerender } = await setup({ selectedId: 'a', insets: { top: 5, bottom: 250 } });
    await emitMapEvent({ type: 'ready' });
    await emitMapEvent({ type: 'region', region: REGION });
    await emitMapEvent({ type: 'error', reason: 'load' });
    expect(screen.getByText('The map didn’t load.')).toBeTruthy();

    await rerender(<PicksMap {...props} selectedId="b" insets={{ top: 5, bottom: 250 }} />);
    await fireEvent.press(screen.getByText('Try again'));
    expect(webViewMounts()).toBe(2);
    expect(screen.queryByText('The map didn’t load.')).toBeNull();
    expect(screen.getByTestId('map-loading')).toBeTruthy();
    const html = (currentWebView().source as { html: string }).html;
    expect(html).toContain('"lat":49.25');
    expect(html).toContain('"zoom":13');

    const before = sentCommands().length;
    await emitMapEvent({ type: 'ready' });
    expect(sentCommands().slice(before)).toEqual([
      { type: 'setInsets', top: 5, bottom: 250 },
      { type: 'setPins', pins: PINS },
      { type: 'select', id: 'b' },
    ]);
  });

  it('shows the error for a style failure too', async () => {
    await setup();
    await emitMapEvent({ type: 'error', reason: 'style' });
    expect(screen.getByText('The map didn’t load.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  describe('navigation', () => {
    it('opens a tapped link in the system browser and keeps the WebView on its own page', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await setup();
      const { onShouldStartLoadWithRequest } = currentWebView();
      expect(
        onShouldStartLoadWithRequest?.({ url: 'https://maplibre.org/', isTopFrame: true, navigationType: 'click' }),
      ).toBe(false);
      expect(open).toHaveBeenCalledWith('https://maplibre.org/');
      expect(
        onShouldStartLoadWithRequest?.({ url: 'http://openstreetmap.org/copyright', isTopFrame: true, navigationType: 'click' }),
      ).toBe(false);
      expect(open).toHaveBeenCalledTimes(2);
    });

    it('opens a link on Android, which reports no navigation type, when it is the top frame', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await setup();
      const { onShouldStartLoadWithRequest } = currentWebView();
      expect(onShouldStartLoadWithRequest?.({ url: 'https://maplibre.org/', isTopFrame: true })).toBe(false);
      expect(open).toHaveBeenCalledWith('https://maplibre.org/');
    });

    it('never opens a script-started, redirected or subframe navigation', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await setup();
      const { onShouldStartLoadWithRequest } = currentWebView();
      for (const request of [
        { url: 'https://evil.example/', isTopFrame: true, navigationType: 'other' },
        { url: 'https://evil.example/', isTopFrame: true, navigationType: 'formsubmit' },
        { url: 'https://evil.example/', isTopFrame: false, navigationType: 'click' },
        { url: 'https://evil.example/', isTopFrame: false },
      ]) {
        expect(onShouldStartLoadWithRequest?.(request)).toBe(false);
      }
      expect(open).not.toHaveBeenCalled();
    });

    it('allows exactly the initial about:blank page and refuses every other URL', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await setup();
      const { onShouldStartLoadWithRequest } = currentWebView();
      expect(onShouldStartLoadWithRequest?.({ url: 'about:blank' })).toBe(true);
      for (const url of [
        'data:text/html,<script>window.ReactNativeWebView.postMessage("x")</script>',
        'about:srcdoc',
        'about:blank#x',
        'javascript:alert(1)',
        'intent://scan',
        'file:///etc/passwd',
        'blob:null/abc',
      ]) {
        expect(onShouldStartLoadWithRequest?.({ url })).toBe(false);
      }
      expect(open).not.toHaveBeenCalled();
    });
  });

  describe('a dead WebView', () => {
    it('shows the error and Try again when iOS ends the web content process', async () => {
      await setup();
      await emitMapEvent({ type: 'ready' });
      await act(async () => currentWebView().onContentProcessDidTerminate?.());
      expect(screen.getByText('The map didn’t load.')).toBeTruthy();
      await fireEvent.press(screen.getByText('Try again'));
      expect(webViewMounts()).toBe(2);
    });

    it('shows the error and Try again when Android’s renderer is gone', async () => {
      await setup();
      await emitMapEvent({ type: 'ready' });
      await act(async () => currentWebView().onRenderProcessGone?.());
      expect(screen.getByText('The map didn’t load.')).toBeTruthy();
      await fireEvent.press(screen.getByText('Try again'));
      expect(webViewMounts()).toBe(2);
    });

    it('shows the error when the page itself fails to load', async () => {
      await setup();
      await act(async () => currentWebView().onError?.());
      expect(screen.getByText('The map didn’t load.')).toBeTruthy();
    });
  });

  it('keeps showing the error when a ready arrives after it', async () => {
    await setup();
    await emitMapEvent({ type: 'error', reason: 'load' });
    await emitMapEvent({ type: 'ready' });
    expect(screen.getByText('The map didn’t load.')).toBeTruthy();
    expect(sentCommands()).toEqual([]);
  });

  it('does not re-send pins whose contents did not change', async () => {
    const { rerender, props } = await setup();
    await emitMapEvent({ type: 'ready' });
    const before = sentCommands().length;
    await rerender(<PicksMap {...props} pins={PINS.map((p) => ({ ...p }))} />);
    expect(sentCommands().length).toBe(before);
    await rerender(<PicksMap {...props} pins={[PINS[0]!]} />);
    expect(sentCommands().slice(before)).toEqual([{ type: 'setPins', pins: [PINS[0]] }]);
  });

  describe('fitOnFirstPins', () => {
    it('sends one fitPins (max zoom 14) after the first non-empty pins, once ready', async () => {
      const { rerender, props } = await setup({ fitOnFirstPins: true, pins: [] });
      await emitMapEvent({ type: 'ready' });
      expect(sentCommands().filter((c) => c.type === 'fitPins')).toEqual([]);
      await rerender(<PicksMap {...props} fitOnFirstPins pins={PINS} />);
      await rerender(<PicksMap {...props} fitOnFirstPins pins={[PINS[0]!]} />);
      const commands = sentCommands();
      expect(commands.filter((c) => c.type === 'fitPins')).toEqual([{ type: 'fitPins', maxZoom: 14 }]);
      const fit = commands.findIndex((c) => c.type === 'fitPins');
      expect(commands[fit - 1]).toEqual({ type: 'setPins', pins: PINS });
    });

    it('fits when the pins were already there before ready, after sending them', async () => {
      await setup({ fitOnFirstPins: true });
      await emitMapEvent({ type: 'ready' });
      expect(sentCommands().map((c) => c.type)).toEqual(['setPins', 'select', 'fitPins']);
    });

    it('does nothing without the prop', async () => {
      await setup();
      await emitMapEvent({ type: 'ready' });
      expect(sentCommands().some((c) => c.type === 'fitPins')).toBe(false);
    });
  });
});
