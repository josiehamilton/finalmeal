import { Tabs, useRouter } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { TabBar } from '../../../src/components/TabBar';

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      backBehavior="history"
      // The centre + is not a tab: it opens the Add-a-dish modal (the add group), over the tabs.
      tabBar={(props) => <TabBar {...props} onAdd={() => router.push('/add')} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.night } }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
