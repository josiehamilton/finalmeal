import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@finalmeal/ui-tokens';
import { SkullMark } from '../../src/components/SkullMark';
import { fontFamily } from '../../src/lib/fonts';
import { useBlockBack } from '../../src/lib/use-block-back';
import { useSession } from '../../src/providers/SessionProvider';

const MIN_VISIBLE_MS = 1200;

/** Shown for at least 1.2 s after onboarding finishes, then hands over to the app. */
export default function LoadingStep() {
  const router = useRouter();
  const { refreshProfile } = useSession();
  const progress = useRef(new Animated.Value(0.1)).current;
  useBlockBack();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Start loading the profile now and wait for the slower of that and the minimum time, so the
    // wait is not the minimum plus the request. A failed load is not fatal here: the You tab
    // shows the error with a Try again button.
    const loaded = refreshProfile().catch(() => null);
    const bar = Animated.timing(progress, {
      toValue: 1,
      duration: MIN_VISIBLE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    bar.start();
    const minimum = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, MIN_VISIBLE_MS);
    });
    Promise.all([loaded, minimum]).then(() => {
      if (!cancelled) router.replace('/(app)/you');
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      bar.stop();
    };
  }, [progress, refreshProfile, router]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <SkullMark size={72} color={colors.ember} />
        <Text style={styles.line}>There can only be five.</Text>
        <View
          style={styles.dots}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              testID={`loading-dot-${i}`}
              style={[styles.dot, i === 0 && styles.dotOn]}
            />
          ))}
        </View>
        <View style={styles.status} accessibilityRole="progressbar" accessibilityLabel="Loading">
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
          <Text style={styles.caption}>Setting your table…</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 32,
  },
  line: {
    fontFamily: fontFamily.display,
    fontSize: 40,
    lineHeight: 40 * 1.15,
    textAlign: 'center',
    color: colors.bone,
  },
  dots: { flexDirection: 'row', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lineStrong },
  dotOn: { backgroundColor: colors.emberGlow },
  status: { marginTop: 40, alignItems: 'center', gap: 12 },
  track: {
    width: 160,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.ember },
  caption: { fontFamily: fontFamily.ui, fontSize: 13, color: colors.dim },
});
