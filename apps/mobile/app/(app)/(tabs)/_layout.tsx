import { Tabs, usePathname, useRouter } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { TabBar } from '../../../src/components/TabBar';

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      backBehavior="history"
      // The centre + is not a tab: it opens the Add-a-dish modal (the add group), over the tabs.
      // `navigate`, not `push`: a quick double tap must not stack two Add modals. `from` is the
      // tab it opened over, so a save lands back there.
      tabBar={(props) => (
        <TabBar
          {...props}
          onAdd={() => router.navigate({ pathname: '/add', params: { from: pathname } })}
        />
      )}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.night } }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="saved" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
