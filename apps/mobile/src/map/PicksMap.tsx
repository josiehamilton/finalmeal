import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { colors, map as mapTokens } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { PrimaryButton } from '../components/PrimaryButton';
import { commandScript, parseMapEvent } from './bridge';
import type { MapCamera, MapCommand, MapPin, MapRegion } from './bridge';
import { buildMapHtml } from './map-page';

/** How far `fitOnFirstPins` zooms in: close enough to read the street, never tighter than that. */
const FIT_MAX_ZOOM = 14;

export interface PicksMapHandle {
  flyTo(camera: MapCamera): void;
}

export interface PicksMapProps {
  /** Where the map opens. Changing it later does nothing: use the handle's `flyTo`. */
  initialCamera: MapCamera;
  pins: MapPin[];
  selectedId: string | null;
  /** How much of the map a sheet or header covers, so pins and fits stay in the open part. */
  insets?: { top: number; bottom: number };
  /** Off for a map that only shows (no pan, no zoom). Fixed when the map starts. */
  interactive?: boolean;
  onRegionChange?: (region: MapRegion) => void;
  onPinPress?: (id: string) => void;
  onMapPress?: () => void;
  /** Frame the pins once, when the first non-empty set arrives. */
  fitOnFirstPins?: boolean;
  testID?: string;
}

type Status = 'loading' | 'ready' | 'error';

/** The commands whose latest value replaces an older, unsent one. */
const LATEST_WINS: ReadonlySet<MapCommand['type']> = new Set(['setPins', 'select', 'setInsets']);

/**
 * The map: maplibre-gl running in a WebView, so it works in Expo Go. The page and this component
 * talk through the typed bridge in `bridge.ts`; commands sent before the page is ready wait in a
 * queue and go out in order once it says `ready`.
 */
export const PicksMap = forwardRef<PicksMapHandle, PicksMapProps>(function PicksMap(props, ref) {
  const {
    initialCamera,
    pins,
    selectedId,
    insets,
    interactive = true,
    testID,
  } = props;

  const web = useRef<WebView<unknown>>(null);
  const ready = useRef(false);
  const queue = useRef<MapCommand[]>([]);
  const fitted = useRef(false);
  /** Set once this WebView has reported a failure: nothing it says afterwards (a late `ready`) counts. */
  const failed = useRef(false);
  /** The pins last sent, as JSON: a new array with the same contents is not sent again. */
  const sentPins = useRef<string | null>(null);
  const latest = useRef({ ...props, pins, selectedId });
  latest.current = { ...props, pins, selectedId };
  /** Where the map was last looking, so "Try again" opens it there instead of back at the start. */
  const lastCamera = useRef<MapCamera>(initialCamera);

  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);
  const [html, setHtml] = useState(() => buildMapHtml({ camera: initialCamera, interactive }));

  const send = useCallback((cmd: MapCommand) => {
    if (ready.current && web.current) {
      web.current.injectJavaScript(commandScript(cmd));
      return;
    }
    if (LATEST_WINS.has(cmd.type)) {
      queue.current = queue.current.filter((queued) => queued.type !== cmd.type);
    }
    queue.current.push(cmd);
  }, []);

  /** The first non-empty pins, once the page is ready, frame themselves once. */
  const fitIfFirst = useCallback(() => {
    const { fitOnFirstPins: wanted, pins: current } = latest.current;
    if (!wanted || !ready.current || fitted.current || current.length === 0) return;
    fitted.current = true;
    send({ type: 'fitPins', maxZoom: FIT_MAX_ZOOM });
  }, [send]);

  useImperativeHandle(ref, () => ({ flyTo: (camera) => send({ type: 'flyTo', camera }) }), [send]);

  const insetTop = insets?.top;
  const insetBottom = insets?.bottom;
  useEffect(() => {
    if (insetTop === undefined || insetBottom === undefined) return;
    send({ type: 'setInsets', top: insetTop, bottom: insetBottom });
  }, [insetTop, insetBottom, send]);

  useEffect(() => {
    const key = JSON.stringify(pins);
    if (key !== sentPins.current) {
      sentPins.current = key;
      send({ type: 'setPins', pins });
    }
    fitIfFirst();
  }, [pins, send, fitIfFirst]);

  useEffect(() => {
    send({ type: 'select', id: selectedId });
  }, [selectedId, send]);

  /** The page failed, or the WebView died: show "The map didn’t load." until Try again. */
  const fail = useCallback(() => {
    failed.current = true;
    ready.current = false;
    setStatus('error');
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const message = parseMapEvent(event.nativeEvent.data);
      if (!message) return;
      const { onRegionChange, onPinPress, onMapPress, pins: current } = latest.current;
      switch (message.type) {
        case 'ready': {
          if (failed.current) break;
          ready.current = true;
          setStatus('ready');
          const waiting = queue.current;
          queue.current = [];
          for (const cmd of waiting) web.current?.injectJavaScript(commandScript(cmd));
          fitIfFirst();
          break;
        }
        case 'region':
          lastCamera.current = {
            lat: message.region.center.lat,
            lng: message.region.center.lng,
            zoom: message.region.zoom,
          };
          onRegionChange?.(message.region);
          break;
        case 'pinPress':
          if (current.some((pin) => pin.id === message.id)) onPinPress?.(message.id);
          break;
        case 'mapPress':
          onMapPress?.();
          break;
        case 'error':
          fail();
          break;
      }
    },
    [fitIfFirst, fail],
  );

  /**
   * Only the initial `about:blank` page loads in the WebView. A link the person taps (the
   * attribution) opens in the system browser; any other navigation, whether from a script, a
   * redirect or a subframe, or to another kind of URL, is refused. iOS says how a navigation
   * started (`click`); Android does not, so a top-frame request there counts as the tap.
   */
  const onShouldStartLoadWithRequest = useCallback(
    (request: { url: string; isTopFrame?: boolean; navigationType?: string }) => {
      const { url, isTopFrame, navigationType } = request;
      if (url === 'about:blank') return true;
      const tapped = navigationType === undefined || navigationType === 'click';
      if (/^https?:/i.test(url) && isTopFrame !== false && tapped) {
        Linking.openURL(url).catch(() => {});
      }
      return false;
    },
    [],
  );

  function tryAgain() {
    const { insets: currentInsets, pins: currentPins, selectedId: currentSelected } = latest.current;
    ready.current = false;
    failed.current = false;
    queue.current = [];
    if (currentInsets) {
      queue.current.push({ type: 'setInsets', top: currentInsets.top, bottom: currentInsets.bottom });
    }
    queue.current.push({ type: 'setPins', pins: currentPins });
    queue.current.push({ type: 'select', id: currentSelected });
    setHtml(buildMapHtml({ camera: lastCamera.current, interactive }));
    setStatus('loading');
    setAttempt((n) => n + 1);
  }

  return (
    <View style={styles.fill} testID={testID}>
      {/* `<unknown>`: the package types `WebView<P = undefined>`, which turns every JSX prop into `never`. */}
      <WebView<unknown>
        key={attempt}
        ref={web}
        style={styles.web}
        source={{ html }}
        originWhitelist={['*']}
        geolocationEnabled={false}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        allowsLinkPreview={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={onMessage}
        onError={fail}
        onContentProcessDidTerminate={fail}
        onRenderProcessGone={fail}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      />
      {status === 'loading' ? (
        <View style={styles.cover} pointerEvents="none" testID="map-loading" />
      ) : null}
      {status === 'error' ? (
        <View style={[styles.cover, styles.errorBox]} testID="map-error">
          <Text style={styles.errorText}>The map didn’t load.</Text>
          <View style={styles.retry}>
            <PrimaryButton label="Try again" variant="secondary" size="compact" onPress={tryAgain} />
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: mapTokens.land },
  web: { flex: 1, backgroundColor: mapTokens.land },
  cover: { ...StyleSheet.absoluteFill, backgroundColor: colors.ash },
  errorBox: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  errorText: { fontFamily: fontFamily.uiSemiBold, fontSize: 15, color: colors.bone },
  retry: { minWidth: 140 },
});
