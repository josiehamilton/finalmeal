import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { SkullMark } from './SkullMark';

/** Stand-in for the tabs that arrive in later phases (Feed, Discover, Add, Saved). */
export function ComingSoon() {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.body}>
        <SkullMark size={40} color={colors.dim} />
        <Text style={styles.title} accessibilityRole="header">
          Coming soon.
        </Text>
        <Text style={styles.text}>This part of Final Meal is still being cooked.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 },
  title: { fontFamily: fontFamily.display, fontSize: 34, color: colors.bone },
  text: {
    fontFamily: fontFamily.ui,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.smoke,
    textAlign: 'center',
  },
});
