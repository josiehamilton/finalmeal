import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/** What expo-router hands a custom tab bar. */
export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'feed', label: 'Feed', icon: 'home' },
  { name: 'discover', label: 'Discover', icon: 'compass' },
  { name: 'add', label: 'Add a dish', icon: 'plus' },
  { name: 'saved', label: 'Saved', icon: 'bookmark' },
  { name: 'you', label: 'You', icon: 'user' },
];

interface TabBarOwnProps {
  /** The centre + is not a tab: it opens the Add-a-dish flow. */
  onAdd: () => void;
}

/** The canvas tab bar: Feed, Discover, a centre ember +, Saved, You. */
export function TabBar({ state, emitter, navigateToTab, onAdd }: TabBarProps & TabBarOwnProps) {
  const current = state.routes[state.index]?.name;

  function press(name: string) {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigateToTab(route.key);
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.bar}>
      <View style={styles.row}>
        {TABS.map(({ name, label, icon }) => {
          const on = current === name;
          if (name === 'add') {
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={onAdd}
                style={styles.add}
              >
                <Icon name="plus" size={26} color={colors.white} strokeWidth={2.25} />
              </Pressable>
            );
          }
          const tint = on ? colors.bone : colors.dim;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              onPress={() => press(name)}
              style={styles.tab}
            >
              <Icon name={icon} size={24} color={tint} strokeWidth={on ? 2 : 1.75} />
              <Text
                style={[
                  styles.label,
                  { color: tint, fontFamily: on ? fontFamily.uiBold : fontFamily.uiMedium },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.ash,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    height: 64,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  tab: { width: 72, alignItems: 'center', gap: 4, paddingTop: 2 },
  label: { fontSize: 11, letterSpacing: 0.02 * 11 },
  add: {
    width: 52,
    height: 52,
    marginTop: -4,
    borderRadius: 16,
    backgroundColor: colors.ember,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
