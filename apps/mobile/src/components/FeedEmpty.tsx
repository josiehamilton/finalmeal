import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { getSuggestedPeople } from '@finalmeal/api';
import type { SuggestedPerson } from '@finalmeal/api';
import { PLACEHOLDER_LINK_DOMAIN } from '@finalmeal/core';
import { colors, typeScale } from '@finalmeal/ui-tokens';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { PersonRow } from './PersonRow';
import { PrimaryButton } from './PrimaryButton';
import { SkullMark } from './SkullMark';

export type FeedEmptyVariant =
  'following-nobody' | 'following-none' | 'nearby-no-city' | 'nearby-empty';

const POPULAR_COUNT = 5;

/** The message people share to invite friends. */
export const INVITE_MESSAGE = `I’m choosing my Final Meal: five dishes, forever. Come pick yours: https://${PLACEHOLDER_LINK_DOMAIN}`;

const COPY: Record<
  FeedEmptyVariant,
  { title: (city: string | null) => string; body?: (city: string | null) => string }
> = {
  'following-nobody': {
    title: () => 'An empty table.',
    body: () => 'Follow a few people and their picks show up here. Better yet, bring your friends.',
  },
  'following-none': {
    title: () => 'Nothing new yet.',
    body: () => 'When people you follow add dishes, they show up here.',
  },
  'nearby-no-city': { title: () => 'Set your home city to see picks near you.' },
  'nearby-empty': {
    title: () => 'Nothing nearby yet.',
    body: (city) => `When people near ${city ?? 'you'} add dishes, they show up here.`,
  },
};

interface FeedEmptyProps {
  variant: FeedEmptyVariant;
  /** The home city's name ("Vancouver"), or null without one. */
  cityName: string | null;
}

/** What a feed says when it has nothing to show, and where to go next. */
export function FeedEmpty({ variant, cityName }: FeedEmptyProps) {
  const router = useRouter();
  const copy = COPY[variant];
  const following = variant === 'following-nobody' || variant === 'following-none';
  const [popular, setPopular] = useState<SuggestedPerson[]>([]);

  // The Popular list is a bonus: if it cannot load, the message above it still stands.
  useEffect(() => {
    if (!following) return;
    let cancelled = false;
    getSuggestedPeople(getSupabase(), POPULAR_COUNT).then(
      (people) => {
        if (!cancelled) setPopular(people);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [following]);

  async function invite() {
    try {
      await Share.share({ message: INVITE_MESSAGE });
    } catch {
      // The sheet could not open; nothing was sent, so there is nothing to undo.
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <SkullMark size={36} color={colors.dim} />
        <Text style={styles.title} accessibilityRole="header">
          {copy.title(cityName)}
        </Text>
        {copy.body ? <Text style={styles.body}>{copy.body(cityName)}</Text> : null}
        {variant === 'following-nobody' ? (
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <PrimaryButton label="Invite friends" size="compact" onPress={() => void invite()} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton
                label="Find people"
                variant="ghost"
                size="compact"
                onPress={() => router.push('/people')}
              />
            </View>
          </View>
        ) : null}
        {variant === 'nearby-no-city' ? (
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <PrimaryButton
                label="Choose home city"
                size="compact"
                onPress={() => router.push('/settings/home-city')}
              />
            </View>
          </View>
        ) : null}
      </View>
      {following && popular.length > 0 ? (
        <View style={styles.popular}>
          <Text style={styles.section} accessibilityRole="header">
            {cityName ? `Popular near ${cityName}` : 'Popular on Final Meal'}
          </Text>
          {popular.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              subtitle={person.topDish ? `#1 · ${person.topDish}` : undefined}
              onOpen={(id) => router.push(`/u/${id}`)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 28, paddingTop: 10 },
  card: {
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ash,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    lineHeight: 32 * 1.15,
    color: colors.bone,
  },
  body: { fontFamily: fontFamily.ui, fontSize: 15, lineHeight: 15 * 1.5, color: colors.smoke },
  buttons: { flexDirection: 'row', gap: 10, paddingTop: 6 },
  flex: { flex: 1 },
  popular: { gap: 4, paddingHorizontal: 8 },
  section: {
    fontFamily: fontFamily.uiBold,
    fontSize: typeScale.label.size,
    letterSpacing: typeScale.label.letterSpacingEm * typeScale.label.size,
    textTransform: 'uppercase',
    color: colors.dim,
  },
});
