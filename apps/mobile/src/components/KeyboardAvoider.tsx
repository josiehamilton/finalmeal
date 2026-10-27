import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import type { ReactNode } from 'react';
import { Keyboard, Platform, StatusBar, StyleSheet, View } from 'react-native';
import type { KeyboardMetrics } from 'react-native';

/**
 * Keeps its content above the on-screen keyboard: it pads its bottom edge by however much the
 * keyboard overlaps it. Use it as the screen's bottom-anchored root (inside the safe area).
 *
 * Why not `KeyboardAvoidingView`: it only learns about the keyboard from show events, so a screen
 * that mounts while the keyboard is already open (Name to Username, where the next field takes
 * focus and the keyboard stays up) is never padded and its button sits behind the keyboard.
 * Here the keyboard that is already showing is measured when the screen mounts.
 */
export function KeyboardAvoider({ children }: { children: ReactNode }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [padding, setPadding] = useState(0);

  useEffect(() => {
    const measure = (metrics: KeyboardMetrics | null | undefined) => {
      if (!metrics || metrics.height <= 0) {
        setPadding(0);
        return;
      }
      // On Android the window's y runs from just under the status bar, while the keyboard's screenY
      // runs from the top of the screen (the app draws edge to edge), so add the bar back.
      const windowTop = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
      ref.current?.measureInWindow((_x, y, _width, height) => {
        setPadding(Math.max(0, y + windowTop + height - metrics.screenY));
      });
    };
    // The keyboard may already be up; ask for it. (`metrics()` is null when it is hidden.)
    measure(Keyboard.metrics());
    const ios = Platform.OS === 'ios';
    const subscriptions = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
        measure(e.endCoordinates),
      ),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setPadding(0)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return (
    <View
      ref={ref}
      testID="keyboard-avoider"
      collapsable={false}
      style={[styles.fill, { paddingBottom: padding }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
