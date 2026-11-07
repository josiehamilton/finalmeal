import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import type { ViewProps } from 'react-native';

/**
 * A stand-in for react-native-webview under Jest: a `View` that records its props and the scripts
 * injected into it. `src/test-support/map.ts` reads this state; nothing else should.
 */
export interface MockWebViewProps extends ViewProps {
  source?: { html?: string; uri?: string };
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  onShouldStartLoadWithRequest?: (request: { url: string; isTopFrame?: boolean }) => boolean;
}

interface Instance {
  props: MockWebViewProps;
}

export const webViewState = {
  /** The WebViews that are mounted now, oldest first. */
  instances: [] as Instance[],
  /** Every script passed to `injectJavaScript`, in order. */
  scripts: [] as string[],
  /** How many WebViews have ever been mounted (a remount adds one). */
  mounts: 0,
  reset() {
    this.instances = [];
    this.scripts = [];
    this.mounts = 0;
  },
};

export const WebView = forwardRef<{ injectJavaScript(script: string): void }, MockWebViewProps>(
  function MockWebView(props, ref) {
    const instance = useRef<Instance>({ props });
    instance.current.props = props;
    useImperativeHandle(ref, () => ({
      injectJavaScript: (script: string) => {
        webViewState.scripts.push(script);
      },
    }));
    useEffect(() => {
      const mounted = instance.current;
      webViewState.instances.push(mounted);
      webViewState.mounts += 1;
      return () => {
        webViewState.instances = webViewState.instances.filter((i) => i !== mounted);
      };
    }, []);
    return <View testID={props.testID ?? 'webview'} />;
  },
);

export default WebView;
