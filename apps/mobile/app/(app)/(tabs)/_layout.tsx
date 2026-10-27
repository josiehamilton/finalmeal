import { Tabs } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { TabBar } from '../../../src/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.night } }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="add" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
