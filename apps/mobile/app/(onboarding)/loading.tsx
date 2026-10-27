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
    const bar = Animated.timing(progress, {
      toValue: 1,
      duration: MIN_VISIBLE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    bar.start();
    const timer = setTimeout(async () => {
      try {
        await refreshProfile();
      } catch {
        // The app loads the profile again on its own; the person should not be stuck here.
      }
      if (!cancelled) router.replace('/(app)/you');
    }, MIN_VISIBLE_MS);
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
