import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@finalmeal/ui-tokens';
import { FeedHeader } from '../../../src/components/FeedHeader';
import { FeedList } from '../../../src/components/FeedList';
import { FirstLanding } from '../../../src/components/FirstLanding';
import { fontFamily } from '../../../src/lib/fonts';
import { useJustOnboarded } from '../../../src/state/landing';

type FeedTab = 'following' | 'nearby';

// Trending is not built yet.
const TABS: { key: FeedTab; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'nearby', label: 'Nearby' },
];

/**
 * The Feed tab: First landing right after onboarding (until the person switches tabs), then the
 * Following and Nearby feeds. A tab's list is built the first time it is opened and kept, so
 * switching back neither reloads it nor loses the place in it.
 */
export default function Feed() {
  const justOnboarded = useJustOnboarded();
  if (justOnboarded) return <FirstLanding />;
  return <FeedTabs />;
}

function FeedTabs() {
  const [tab, setTab] = useState<FeedTab>('following');
  const [opened, setOpened] = useState<ReadonlySet<FeedTab>>(new Set<FeedTab>(['following']));

  function choose(next: FeedTab) {
    setTab(next);
    setOpened((current) => (current.has(next) ? current : new Set(current).add(next)));
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FeedHeader />
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map(({ key, label }) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              onPress={() => choose(key)}
              style={[styles.tab, on && styles.tabOn]}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {TABS.filter(({ key }) => opened.has(key)).map(({ key }) => (
        <View key={key} style={[styles.list, tab !== key && styles.hidden]}>
          <FeedList mode={key} />
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  tabs: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabOn: { borderBottomColor: colors.emberGlow },
  tabText: { fontFamily: fontFamily.uiBold, fontSize: 14, color: colors.dim },
  tabTextOn: { color: colors.bone },
  list: { flex: 1 },
  hidden: { display: 'none' },
});
