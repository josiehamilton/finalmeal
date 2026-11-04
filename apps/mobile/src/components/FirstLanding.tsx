import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { friendlyMessage, getMyPicks, getNearbyFeed, getPlacePickers } from '@finalmeal/api';
import type { FeedItem, Pick } from '@finalmeal/api';
import { FINAL_MEAL_SIZE, othersAtPlaceLabel } from '@finalmeal/core';
import { colors } from '@finalmeal/ui-tokens';
import { cityName } from '../lib/city-name';
import { fontFamily } from '../lib/fonts';
import { getSupabase } from '../lib/supabase';
import { useSession } from '../providers/SessionProvider';
import { usePicksVersion } from '../state/pick-changes';
import { Avatar } from './Avatar';
import { FeedCard } from './FeedCard';
import { FeedHeader } from './FeedHeader';
import { Icon } from './Icon';
import { PhotoNotice } from './PhotoNotice';
import { PrimaryButton } from './PrimaryButton';
import { SkullMark } from './SkullMark';

const NEARBY_COUNT = 3;
const PICKER_AVATARS = 3;
/** The Nearby cards are shorter here than in the feed, as on the First landing board. */
const NEARBY_PHOTO_HEIGHT = 150;

const SEATS = Array.from({ length: FINAL_MEAL_SIZE }, (_, i) => i + 1);

/** "4 seats left", "1 seat left". */
export function seatsLeftLabel(chosen: number): string {
  const left = Math.max(0, FINAL_MEAL_SIZE - chosen);
  return `${left} ${left === 1 ? 'seat' : 'seats'} left`;
}

/**
 * First landing: where a new person arrives after onboarding. The wordmark, a welcome, their
 * slot-1 dish as a hero card with who else in the city has that spot on their list, how many
 * seats are left, a way to add the next dish, and the first Nearby picks. The Feed tab shows it
 * right after onboarding, until the person switches tabs.
 */
export function FirstLanding() {
  const router = useRouter();
  // Add returns here when it closes.
  const pathname = usePathname();
  const { profile } = useSession();
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [pickers, setPickers] = useState<Awaited<ReturnType<typeof getPlacePickers>> | null>(null);
  const [nearby, setNearby] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadId = useRef(0);
  const picksVersion = usePicksVersion();

  const load = useCallback(async () => {
    const id = ++loadId.current;
    setError(null);
    try {
      const loaded = await getMyPicks(getSupabase());
      if (id === loadId.current) setPicks(loaded);
    } catch (e) {
      if (id === loadId.current) setError(friendlyMessage(e));
    }
  }, []);

  // Loads on arrival and again whenever the picks change elsewhere (a save, a swap, a removal).
  useEffect(() => {
    void load();
  }, [load, picksVersion]);

  const finals = useMemo(
    () =>
      (picks ?? [])
        .filter((p) => p.tier === 'final')
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
    [picks],
  );
  const hero = finals[0] ?? null;
  const heroPlaceId = hero?.place.id ?? null;
  const homeCityId = profile?.homeCity?.id ?? null;
  const homeCityName = profile?.homeCity ? cityName(profile.homeCity.label) : null;
  const full = finals.length >= FINAL_MEAL_SIZE;
  const firstName = profile?.displayName.trim().split(/\s+/)[0] ?? '';

  // Who else has the hero's spot on their list. Nice to have: if it fails, the line just is not there.
  useEffect(() => {
    setPickers(null);
    if (!heroPlaceId) return;
    let cancelled = false;
    getPlacePickers(getSupabase(), heroPlaceId).then(
      (found) => {
        if (!cancelled) setPickers(found);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [heroPlaceId]);

  // The first Nearby picks around the home city (never the phone's position). Without a home city
  // or any picks the section is not shown.
  useEffect(() => {
    setNearby([]);
    if (!homeCityId) return;
    let cancelled = false;
    getNearbyFeed(getSupabase(), 0, NEARBY_COUNT).then(
      (page) => {
        if (!cancelled) setNearby(page.items.slice(0, NEARBY_COUNT));
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [homeCityId]);

  const othersLine = hero && pickers
    ? othersAtPlaceLabel(pickers.otherCount, hero.place.city, hero.place.name)
    : null;

  function addDish() {
    // navigate, not push: a quick double tap must not stack two Add modals. With all five seats
    // taken, the next dish can only be an Honorable Mention.
    router.navigate({ pathname: '/add', params: { tier: full ? 'honorable' : 'final', from: pathname } });
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <FeedHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text style={styles.welcome}>{firstName ? `Welcome, ${firstName}` : 'Welcome'}</Text>
          {picks ? (
            <Text style={styles.title}>
              {hero ? 'Your Final Meal has begun.' : 'Your table is set.'}
            </Text>
          ) : null}
        </View>

        <PhotoNotice />

        {picks === null ? (
          error ? (
            <View style={styles.problem}>
              <Text style={styles.problemText} accessibilityRole="alert">
                {error}
              </Text>
              <PrimaryButton label="Try again" onPress={() => void load()} />
            </View>
          ) : (
            <ActivityIndicator testID="landing-loading" color={colors.emberGlow} />
          )
        ) : (
          <View style={styles.card}>
            {hero ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${hero.dish.name}`}
                  onPress={() => router.push(`/pick/${hero.id}`)}
                  style={styles.photo}
                >
                  {hero.photoUrl ? (
                    <Image source={{ uri: hero.photoUrl }} style={styles.photoImage} />
                  ) : (
                    <Icon name="image" size={28} color={colors.dim} />
                  )}
                  <View style={styles.badge}>
                    <SkullMark size={12} color={colors.white} />
                    <Text style={styles.badgeText}>Final Meal · #1</Text>
                  </View>
                </Pressable>
                <View style={styles.details}>
                  <Text style={styles.dish}>{hero.dish.name}</Text>
                  <View style={styles.where}>
                    <Icon name="pin" size={14} color={colors.smoke} />
                    <Text style={styles.whereText} numberOfLines={1}>
                      {`${hero.place.name} · ${hero.place.city}`}
                    </Text>
                  </View>
                  {hero.note ? <Text style={styles.note}>{`“${hero.note}”`}</Text> : null}
                  {othersLine && pickers ? (
                    <View style={styles.others}>
                      <View style={styles.avatars}>
                        {pickers.people.slice(0, PICKER_AVATARS).map((person, i) => (
                          <View
                            key={person.id}
                            testID="landing-picker"
                            style={[styles.avatarRing, i > 0 && styles.avatarOverlap]}
                          >
                            <Avatar
                              uri={person.avatarUrl}
                              name={person.displayName}
                              size={22}
                              accessibilityLabel={`${person.displayName}’s photo`}
                            />
                          </View>
                        ))}
                      </View>
                      <Text style={styles.othersText}>{othersLine}</Text>
                    </View>
                  ) : null}
                  <View style={styles.rule} />
                </View>
              </>
            ) : null}
            <View style={styles.seatsRow}>
              <View
                accessible
                accessibilityLabel={`${finals.length} of ${FINAL_MEAL_SIZE} chosen`}
                style={styles.seats}
              >
                {SEATS.map((n) => (
                  <View
                    key={n}
                    style={[styles.seat, n <= finals.length ? styles.seatOn : styles.seatOff]}
                  >
                    <Text style={[styles.seatNumber, n <= finals.length && styles.seatNumberOn]}>
                      {n}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.seatsLeft}>
                {full ? 'All five seats taken' : seatsLeftLabel(finals.length)}
              </Text>
            </View>
            <View style={styles.cta}>
              <PrimaryButton
                label={
                  full ? 'Add an Honorable Mention' : hero ? 'Add your next dish' : 'Add your first dish'
                }
                icon={<Icon name="plus" size={18} color={colors.white} />}
                onPress={addDish}
              />
            </View>
          </View>
        )}
        {picks !== null && homeCityName && nearby.length > 0 ? (
          <>
            <Text style={styles.nearbyTitle} accessibilityRole="header">
              {`Nearby in ${homeCityName}`}
            </Text>
            {nearby.map((item) => (
              <FeedCard key={item.key} item={item} photoHeight={NEARBY_PHOTO_HEIGHT} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  content: { gap: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 32 },
  heading: { gap: 4, paddingHorizontal: 6 },
  welcome: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    textTransform: 'uppercase',
    color: colors.dim,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    lineHeight: 32 * 1.1,
    color: colors.bone,
  },
  problem: { gap: 16, alignItems: 'stretch', paddingHorizontal: 12, paddingTop: 12 },
  problemText: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 15,
    color: colors.bone,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.ash,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 22,
    overflow: 'hidden',
  },
  photo: {
    height: 150,
    backgroundColor: colors.ashRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.ember,
  },
  badgeText: {
    fontFamily: fontFamily.uiBold,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    color: colors.white,
  },
  details: { gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  dish: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 28 * 1.05, color: colors.bone },
  where: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whereText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  note: { fontFamily: fontFamily.serifItalic, fontSize: 16, color: colors.bone },
  others: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatars: { flexDirection: 'row' },
  avatarRing: { borderWidth: 2, borderColor: colors.ash, borderRadius: 999 },
  avatarOverlap: { marginLeft: -8 },
  othersText: { flex: 1, fontFamily: fontFamily.ui, fontSize: 12, color: colors.smoke },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  seats: { flexDirection: 'row', gap: 6 },
  seat: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatOn: { borderStyle: 'solid', borderColor: colors.emberGlow, backgroundColor: colors.emberWash },
  seatOff: { borderStyle: 'dashed', borderColor: colors.lineStrong },
  seatNumber: { fontFamily: fontFamily.serifItalic, fontSize: 16, color: colors.dim },
  seatNumberOn: { color: colors.emberGlow },
  seatsLeft: { flex: 1, fontFamily: fontFamily.ui, fontSize: 13, color: colors.smoke },
  cta: { padding: 16 },
  nearbyTitle: {
    paddingHorizontal: 6,
    paddingTop: 6,
    fontFamily: fontFamily.display,
    fontSize: 24,
    color: colors.bone,
  },
});
