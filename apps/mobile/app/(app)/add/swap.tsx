import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@finalmeal/ui-tokens';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { fontFamily } from '../../../src/lib/fonts';

/** Placeholder: Task 6 replaces this with the Swap screen (choose which Final Meal pick to replace). */
export default function Swap() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Choose one to replace" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={styles.text}>Swapping arrives in the next build.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  text: { fontFamily: fontFamily.ui, fontSize: 15, color: colors.smoke, textAlign: 'center' },
});
