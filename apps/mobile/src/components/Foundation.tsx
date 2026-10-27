import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatStats } from '@finalmeal/api';
import type { FoundationStats } from '@finalmeal/api';
import { WORDMARK_TEXT, colors, radii, typeScale } from '@finalmeal/ui-tokens';
import { SkullMark } from './SkullMark';

const TAGLINE = 'Five dishes. That’s it. Choose.';
const LOADING = '…';
const UNREACHABLE = 'Can’t reach the kitchen right now.';

const SWATCHES = [
  { label: 'Ember', color: colors.ember },
  { label: 'Ember Glow', color: colors.emberGlow },
  { label: 'Bone', color: colors.bone },
  { label: 'Night', color: colors.night },
] as const;

// Loaded in app/_layout.tsx; names must match the keys passed to useFonts.
export const fontFamily = {
  wordmark: 'InstrumentSerif_400Regular',
  tagline: 'Newsreader_300Light_Italic',
  ui: 'Manrope_400Regular',
  uiBold: 'Manrope_700Bold',
} as const;

interface FoundationProps {
  loadStats: () => Promise<FoundationStats>;
}

export function Foundation({ loadStats }: FoundationProps) {
  const [statsLine, setStatsLine] = useState<string>(LOADING);

  useEffect(() => {
    let active = true;
    loadStats().then(
      (stats) => active && setStatsLine(formatStats(stats)),
      () => active && setStatsLine(UNREACHABLE),
    );
    return () => {
      active = false;
    };
  }, [loadStats]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <SkullMark size={96} color={colors.ember} title={WORDMARK_TEXT} />
      <Text style={styles.wordmark} accessibilityRole="header">
        {WORDMARK_TEXT}
      </Text>
      <Text style={styles.tagline}>{TAGLINE}</Text>
      <View style={styles.swatches}>
        {SWATCHES.map(({ label, color }) => (
          <View key={label} style={styles.swatch}>
            <View style={[styles.chip, { backgroundColor: color }]} />
            <Text style={styles.swatchLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.stats}>{statsLine}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  wordmark: {
    fontFamily: fontFamily.wordmark,
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -0.01 * 56,
    color: colors.bone,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fontFamily.tagline,
    fontSize: 22,
    lineHeight: 22 * 1.3,
    color: colors.smoke,
    textAlign: 'center',
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    columnGap: 20,
    marginTop: 12,
  },
  swatch: { alignItems: 'center', gap: 8 },
  chip: {
    width: 56,
    height: 56,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  swatchLabel: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.smoke,
  },
  stats: {
    marginTop: 12,
    fontFamily: fontFamily.ui,
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.size * typeScale.body.lineHeight,
    color: colors.smoke,
    textAlign: 'center',
  },
});
