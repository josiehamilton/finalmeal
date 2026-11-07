import { act } from '@testing-library/react-native';
import * as webview from 'react-native-webview';
import type { MapCommand, MapEvent } from '../map/bridge';

/** The recorded state of the `react-native-webview` mock (`apps/mobile/__mocks__`). */
interface WebViewMockState {
  instances: Array<{
    props: {
      onMessage?: (event: { nativeEvent: { data: string } }) => void;
      onShouldStartLoadWithRequest?: (request: { url: string; isTopFrame?: boolean }) => boolean;
      source?: { html?: string };
    };
  }>;
  scripts: string[];
  mounts: number;
  reset(): void;
}

/** Read through a plain import, so it is the very module instance the component under test uses. */
function state(): WebViewMockState {
  return (webview as unknown as { webViewState: WebViewMockState }).webViewState;
}

/** Forgets every WebView and script of earlier tests. Call it in `beforeEach`. */
export function resetMapMock() {
  state().reset();
}

/** The WebView that is mounted now (the newest one). */
export function currentWebView() {
  const instance = state().instances[state().instances.length - 1];
  if (!instance) throw new Error('No WebView is mounted');
  return instance.props;
}

/** How many WebViews have been mounted since `resetMapMock` (a remount adds one). */
export function webViewMounts(): number {
  return state().mounts;
}

/** The map page sends the app an event. */
export async function emitMapEvent(event: MapEvent) {
  await emitRawMapMessage(JSON.stringify(event));
}

/** The map page sends the app a raw message (for malformed ones). */
export async function emitRawMapMessage(data: string) {
  const { onMessage } = currentWebView();
  await act(async () => {
    onMessage?.({ nativeEvent: { data } });
  });
}

/** Every command the app has injected into the page, in order. */
export function sentCommands(): MapCommand[] {
  const prefix = 'window.__fm&&window.__fm.receive(';
  const suffix = ');true;';
  return state().scripts.map((script) => {
    if (!script.startsWith(prefix) || !script.endsWith(suffix)) {
      throw new Error(`Not a map command: ${script}`);
    }
    return JSON.parse(script.slice(prefix.length, script.length - suffix.length)) as MapCommand;
  });
}
