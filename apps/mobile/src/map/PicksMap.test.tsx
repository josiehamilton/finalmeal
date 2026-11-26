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
import { MAP_LOAD_TIMEOUT_MS } from './map-page';
import { PicksMap, TOUCH_LOCK_TIMEOUT_MS } from './PicksMap';
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
  const props: PicksMapProps = {
    initialCamera: CAMERA,
    pins: PINS,
    selectedId: null,
    ...overrides,
  };
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
    await rerender(
      <PicksMap {...props} pins={[PINS[0]!]} selectedId="a" insets={{ top: 10, bottom: 200 }} />,
    );
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
    await emitRawMapMessage(
      '{"type":"region","region":{"bounds":{"west":0,"south":95,"east":1,"north":96},"center":{"lat":0,"lng":0},"zoom":3}}',
    );
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

    it('refuses every http(s) navigation outright, whatever the platform says about it', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await setup();
      const { onShouldStartLoadWithRequest } = currentWebView();
      const url = 'https://maplibre.org/';
      for (const request of [
        // iOS: a tap, a script, a form, a subframe
        { url, isTopFrame: true, navigationType: 'click' },
        { url, isTopFrame: true, navigationType: 'other' },
        { url, isTopFrame: true, navigationType: 'formsubmit' },
        { url, isTopFrame: false, navigationType: 'click' },
        // Android sends only the url (react-native-webview 14 adds no isTopFrame or navigationType)
        { url },
        { url: 'http://openstreetmap.org/copyright' },
      ]) {
        expect(onShouldStartLoadWithRequest?.(request)).toBe(false);
      }
      expect(open).not.toHaveBeenCalled();
    });

    it('opens a link the page reports from a real tap, in the system browser', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await setup();
      await emitMapEvent({ type: 'openLink', url: 'https://www.openstreetmap.org/copyright' });
      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright');
    });

    it('ignores a link from a host it does not know, or a malformed one', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
      await setup();
      await emitRawMapMessage('{"type":"openLink","url":"https://evil.example/"}');
      await emitRawMapMessage('{"type":"openLink","url":"javascript:alert(1)"}');
      await emitRawMapMessage('{"type":"openLink"}');
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

  describe('the load watchdog', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());
    const patience = MAP_LOAD_TIMEOUT_MS + 5000;

    it('gives up on a page that never says anything, and Try again waits for it afresh', async () => {
      await setup();
      await act(async () => jest.advanceTimersByTime(patience - 1));
      expect(screen.queryByText('The map didn’t load.')).toBeNull();
      await act(async () => jest.advanceTimersByTime(2));
      expect(screen.getByText('The map didn’t load.')).toBeTruthy();

      await fireEvent.press(screen.getByText('Try again'));
      expect(screen.queryByText('The map didn’t load.')).toBeNull();
      await act(async () => jest.advanceTimersByTime(patience + 1));
      expect(screen.getByText('The map didn’t load.')).toBeTruthy();
    });

    it('stays quiet once the page is ready', async () => {
      await setup();
      await emitMapEvent({ type: 'ready' });
      await act(async () => jest.advanceTimersByTime(patience * 3));
      expect(screen.queryByText('The map didn’t load.')).toBeNull();
    });

    it('stops waiting when the map is unmounted', async () => {
      const started = jest.spyOn(globalThis, 'setTimeout');
      const cleared = jest.spyOn(globalThis, 'clearTimeout');
      const { unmount } = await setup();
      const index = started.mock.calls.findIndex(([, ms]) => ms === patience);
      expect(index).toBeGreaterThanOrEqual(0);
      const watchdog = started.mock.results[index]?.value as unknown;
      await unmount();
      expect(cleared).toHaveBeenCalledWith(watchdog);
    });
  });

  it('drops flyTo commands while the error shows, so Try again does not fly somewhere stale', async () => {
    const ref = createRef<PicksMapHandle>();
    await render(<PicksMap ref={ref} initialCamera={CAMERA} pins={[]} selectedId={null} />);
    await act(async () => ref.current?.flyTo({ lat: 1, lng: 2, zoom: 15 }));
    await emitMapEvent({ type: 'error', reason: 'load' });
    await act(async () => ref.current?.flyTo({ lat: 3, lng: 4, zoom: 15 }));
    await fireEvent.press(screen.getByText('Try again'));
    await emitMapEvent({ type: 'ready' });
    expect(sentCommands().some((c) => c.type === 'flyTo')).toBe(false);
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
      expect(commands.filter((c) => c.type === 'fitPins')).toEqual([
        { type: 'fitPins', maxZoom: 14 },
      ]);
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

describe('PicksMap: embedded scroll lock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('locks on touch, unlocks on end, and unlocks by itself if the end never arrives', async () => {
    const onTouchLock = jest.fn();
    await setup({ embedded: true, onTouchLock, testID: 'map' });
    const box = screen.getByTestId('map');
    await fireEvent(box, 'touchStart');
    expect(onTouchLock).toHaveBeenLastCalledWith(true);
    await fireEvent(box, 'touchEnd');
    expect(onTouchLock).toHaveBeenLastCalledWith(false);
    onTouchLock.mockClear();
    await fireEvent(box, 'touchStart');
    await act(async () => jest.advanceTimersByTime(TOUCH_LOCK_TIMEOUT_MS - 100));
    await fireEvent(box, 'touchMove');
    await act(async () => jest.advanceTimersByTime(TOUCH_LOCK_TIMEOUT_MS - 100));
    expect(onTouchLock).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTime(200));
    expect(onTouchLock).toHaveBeenLastCalledWith(false);
  });

  it('locks again when a move arrives after the lease expired, and unlocks on end', async () => {
    const onTouchLock = jest.fn();
    const view = await setup({ embedded: true, onTouchLock, testID: 'map' });
    const box = view.getByTestId('map');
    await fireEvent(box, 'touchStart');
    await act(async () => jest.advanceTimersByTime(TOUCH_LOCK_TIMEOUT_MS + 100));
    expect(onTouchLock).toHaveBeenLastCalledWith(false);
    onTouchLock.mockClear();
    await fireEvent(box, 'touchMove');
    expect(onTouchLock).toHaveBeenLastCalledWith(true);
    await fireEvent(box, 'touchEnd');
    expect(onTouchLock).toHaveBeenLastCalledWith(false);
  });

  it('releases a held lock when the map unmounts', async () => {
    const onTouchLock = jest.fn();
    const view = await setup({ embedded: true, onTouchLock, testID: 'map' });
    await fireEvent(view.getByTestId('map'), 'touchStart');
    onTouchLock.mockClear();
    await view.unmount();
    expect(onTouchLock).toHaveBeenLastCalledWith(false);
  });

  it('does not call the lock on unmount when none is held', async () => {
    const onTouchLock = jest.fn();
    const view = await setup({ embedded: true, onTouchLock, testID: 'map' });
    await view.unmount();
    expect(onTouchLock).not.toHaveBeenCalled();
  });
});
