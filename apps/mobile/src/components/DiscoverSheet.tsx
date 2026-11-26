import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { DiscoverDish } from '@finalmeal/api';
import { colors } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { DiscoverDishCard } from './DiscoverDishCard';
import { PrimaryButton } from './PrimaryButton';

export type DiscoverSheetMode =
  /** Loading, or loaded with picks in view. */
  | 'picks'
  | 'empty'
  | 'emptyFiltered'
  /** No home city and the map still shows the world. */
  | 'noHome'
  | 'error';

interface DiscoverSheetProps {
  mode: DiscoverSheetMode;
  /** `12 picks near Vancouver`. */
  title: string;
  dishes: DiscoverDish[];
  /** More places than pins: ask for a closer look. */
  truncated: boolean;
  /** The first load is still running and there is nothing to show yet. */
  loading: boolean;
  error: string | null;
  onOpenList: () => void;
  onOpenPick: (pickId: string) => void;
  onResetFilters: () => void;
  onChooseHomeCity: () => void;
  onRetry: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

/** The bottom sheet over the map: what is in view, as a row of dish cards. */
export function DiscoverSheet({
  mode,
  title,
  dishes,
  truncated,
  loading,
  error,
  onOpenList,
  onOpenPick,
  onResetFilters,
  onChooseHomeCity,
  onRetry,
  onLayout,
}: DiscoverSheetProps) {
  const showCards = (mode === 'picks' || mode === 'noHome') && dishes.length > 0;
  return (
    <View style={styles.sheet} onLayout={onLayout}>
      <View accessible={false} style={styles.handle} />
      {mode === 'picks' ? (
        loading ? (
          <ActivityIndicator accessibilityLabel="Loading" color={colors.dim} style={styles.spinner} />
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              <Pressable accessibilityRole="link" accessibilityLabel="List view" onPress={onOpenList} hitSlop={8}>
                <Text style={styles.link}>List view</Text>
              </Pressable>
            </View>
            {truncated ? <Text style={styles.note}>Zoom in to see every pick.</Text> : null}
          </>
        )
      ) : null}
      {mode === 'empty' ? (
        <View style={styles.message}>
          <Text style={styles.title} accessibilityRole="header">
            No picks here yet.
          </Text>
          <Text style={styles.body}>Move the map or zoom out to find more.</Text>
        </View>
      ) : null}
      {mode === 'emptyFiltered' ? (
        <View style={styles.message}>
          <Text style={styles.title} accessibilityRole="header">
            No picks match these filters.
          </Text>
          <Pressable accessibilityRole="link" accessibilityLabel="Reset filters" onPress={onResetFilters} hitSlop={8}>
            <Text style={styles.link}>Reset filters</Text>
          </Pressable>
        </View>
      ) : null}
      {mode === 'noHome' ? (
        <View style={styles.message}>
          <Text style={styles.title} accessibilityRole="header">
            Set your home city to start the map there.
          </Text>
          {truncated ? <Text style={styles.note}>Zoom in to see every pick.</Text> : null}
          <View style={styles.outline}>
            <PrimaryButton variant="ghost" size="compact" label="Choose home city" onPress={onChooseHomeCity} />
          </View>
        </View>
      ) : null}
      {mode === 'error' ? (
        <View style={styles.message}>
          <Text style={styles.body} accessibilityRole="alert">
            {error}
          </Text>
          <View style={styles.outline}>
            <PrimaryButton variant="ghost" size="compact" label="Try again" onPress={onRetry} />
          </View>
        </View>
      ) : null}
      {showCards ? (
        <ScrollView
          testID="discover-cards"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}
        >
          {dishes.map((dish) => (
            <DiscoverDishCard key={`${dish.dishId}:${dish.place.id}`} dish={dish} onOpenPick={onOpenPick} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: colors.ash,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: colors.lineStrong,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { flexShrink: 1, fontFamily: fontFamily.uiBold, fontSize: 17, color: colors.bone },
  link: { fontFamily: fontFamily.uiBold, fontSize: 13, color: colors.emberGlow },
  note: { paddingHorizontal: 20, marginTop: -6, fontFamily: fontFamily.ui, fontSize: 12, color: colors.dim },
  message: { paddingHorizontal: 20, gap: 8, alignItems: 'flex-start' },
  body: { fontFamily: fontFamily.ui, fontSize: 14, color: colors.smoke },
  outline: { minWidth: 180 },
  cards: { gap: 12, paddingHorizontal: 20 },
  spinner: { paddingVertical: 16 },
});
