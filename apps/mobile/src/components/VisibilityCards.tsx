import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type Visibility = 'public' | 'private';

interface Option {
  value: Visibility;
  title: string;
  icon: IconName;
  lines: string[];
}

const OPTIONS: Option[] = [
  {
    value: 'public',
    title: 'Public',
    icon: 'users',
    lines: ['Anyone can see your profile, picks and lists', 'People can follow you straight away'],
  },
  {
    value: 'private',
    title: 'Private',
    icon: 'lock',
    lines: [
      'People can still find you by name',
      'Your picks, lists and home city are only for followers you approve',
      'Your picks still help the map, without your name',
      'Lists you share by link still show you',
    ],
  },
];

interface VisibilityCardsProps {
  value: Visibility;
  onChange: (next: Visibility) => void;
}

/** The Public / Private radio group (canvas "Profile visibility"; copy from spec 5.5). */
export function VisibilityCards({ value, onChange }: VisibilityCardsProps) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Profile visibility"
      style={styles.group}
    >
      {OPTIONS.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(option.value)}
            style={[styles.card, on && styles.cardOn]}
          >
            <View style={styles.head}>
              <View style={styles.badge}>
                <Icon name={option.icon} size={18} color={colors.bone} />
              </View>
              <Text style={styles.title}>{option.title}</Text>
              <View style={[styles.radio, on && styles.radioOn]}>
                {on ? <View style={styles.dot} /> : null}
              </View>
            </View>
            <View style={styles.lines}>
              {option.lines.map((line) => (
                <View key={line} style={styles.line}>
                  <View style={styles.tick}>
                    <Icon
                      name="check"
                      size={15}
                      color={on ? colors.emberGlow : colors.dim}
                      strokeWidth={2.25}
                    />
                  </View>
                  <Text style={styles.lineText}>{line}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.ash,
  },
  cardOn: { borderWidth: 1.5, borderColor: colors.emberGlow, backgroundColor: colors.emberWash },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: fontFamily.uiBold, fontSize: 17, color: colors.bone },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.emberGlow },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.emberGlow },
  lines: { gap: 6 },
  line: { flexDirection: 'row', gap: 8 },
  tick: { paddingTop: 2 },
  lineText: {
    flex: 1,
    fontFamily: fontFamily.ui,
    fontSize: 13,
    lineHeight: 13 * 1.45,
    color: colors.smoke,
  },
});
