/**
 * Shared copy and small rules for the social screens (feeds, notifications, Saved). Pure
 * functions with no backend or UI imports, so web and mobile say the same things.
 */

/** The kinds of card the feeds show (a subset of `ActivityType`). */
export type FeedKind = 'added_final' | 'added_honorable' | 'promoted' | 'dethroned';

/** Every kind of activity (the same names as the `activity_type` enum in the database). */
export type ActivityType =
  | 'added_final'
  | 'added_honorable'
  | 'dethroned'
  | 'promoted'
  | 'followed'
  | 'saved_pick'
  | 'saved_from_list'
  | 'follow_requested'
  | 'follow_accepted';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A short age label: `now`, `<n>m`, `<n>h`, `Yesterday` (24 to 48 hours), `<n>d` (under a week),
 * then the date, for example `12 Oct`. A time in the future counts as `now`.
 */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const elapsed = now.getTime() - then.getTime();
  if (elapsed < MINUTE_MS) return 'now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;
  if (elapsed < 2 * DAY_MS) return 'Yesterday';
  if (elapsed < 7 * DAY_MS) return `${Math.floor(elapsed / DAY_MS)}d`;
  return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
}

/** True when `iso` falls on the same calendar day as `now`, in the device's time zone. */
export function isSameLocalDay(iso: string, now: Date): boolean {
  const then = new Date(iso);
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  );
}

/** What a feed card says after the person's name. */
export function feedCaption(kind: FeedKind, otherDishName: string | null): string {
  switch (kind) {
    case 'added_honorable':
      return 'added an Honorable Mention';
    case 'promoted':
      return 'promoted to their Final Meal';
    case 'dethroned':
      return otherDishName
        ? `dethroned ${otherDishName} from their Final Meal`
        : 'added to their Final Meal';
    case 'added_final':
      return 'added to their Final Meal';
  }
}

/** `On 8 lists`, `On 1 Final Meal`; null at zero (show nothing). */
export function countLabel(n: number, unit: 'list' | 'finalMeal'): string | null {
  if (n <= 0) return null;
  const noun = unit === 'list' ? 'list' : 'Final Meal';
  return `On ${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** `8 others in Vancouver have Skewers on their list`; null at zero. */
export function othersAtPlaceLabel(n: number, city: string, place: string): string | null {
  if (n <= 0) return null;
  return n === 1
    ? `1 other in ${city} has ${place} on their list`
    : `${n} others in ${city} have ${place} on their list`;
}

export interface SentenceSegment {
  text: string;
  /** `name` is the person, `dish` a dish or list title, `plain` the connecting words. */
  style: 'name' | 'dish' | 'plain';
}

export interface ActivitySentenceInput {
  type: ActivityType;
  actorName: string;
  dishName: string | null;
  otherDishName: string | null;
  listTitle: string | null;
  /** Only meaningful for `follow_requested`: false once the request has been answered. */
  requestPending: boolean;
}

/**
 * The notification sentence as styled segments. The words match the push text the database
 * queues (`_push_text`), including its stand-ins when a dish is gone.
 */
export function activitySentence(a: ActivitySentenceInput): SentenceSegment[] {
  const name: SentenceSegment = { text: a.actorName, style: 'name' };
  const plain = (text: string): SentenceSegment => ({ text, style: 'plain' });
  const dish = (text: string): SentenceSegment => ({ text, style: 'dish' });
  switch (a.type) {
    case 'followed':
      return [name, plain(' started following you.')];
    case 'follow_requested':
      return [name, plain(a.requestPending ? ' wants to follow you.' : ' started following you.')];
    case 'follow_accepted':
      return [name, plain(' approved your follow request.')];
    case 'saved_pick':
      return [name, plain(' saved your '), dish(a.dishName ?? 'pick'), plain('.')];
    case 'saved_from_list':
      return [name, plain(' saved picks from your list '), dish(a.listTitle ?? ''), plain('.')];
    case 'dethroned':
      return [
        name,
        plain(' dethroned '),
        dish(a.otherDishName ?? 'a dish'),
        plain(' with '),
        dish(a.dishName ?? 'a dish'),
        plain(' on their Final Meal.'),
      ];
    case 'added_final':
      return [name, plain(' added '), dish(a.dishName ?? 'a dish'), plain(' to their Final Meal.')];
    case 'promoted':
      return [
        name,
        plain(' promoted '),
        dish(a.dishName ?? 'a dish'),
        plain(' to their Final Meal.'),
      ];
    case 'added_honorable':
      return [
        name,
        plain(' added '),
        dish(a.dishName ?? 'a dish'),
        plain(' as an Honorable Mention.'),
      ];
  }
}

/** A Saved board chip. */
export type SaveFilter = 'all' | 'final' | 'honorable' | 'nearby';

/** "Nearby" is within this many metres of the person's chosen home city, never their phone. */
export const NEARBY_RADIUS_M = 25000;

/** The smallest shape `filterSaves` needs; the API's `SavedDish` satisfies it. */
export interface SaveLike {
  /** The tier of the pick it was saved from; null when saved with no pick or the pick is gone. */
  viaTier: 'final' | 'honorable' | null;
  distanceM: number | null;
}

/** The saves a chip shows, in the same order. A save with no distance is never "nearby". */
export function filterSaves<S extends SaveLike>(saves: readonly S[], filter: SaveFilter): S[] {
  switch (filter) {
    case 'all':
      return [...saves];
    case 'final':
    case 'honorable':
      return saves.filter((s) => s.viaTier === filter);
    case 'nearby':
      return saves.filter((s) => s.distanceM !== null && s.distanceM <= NEARBY_RADIUS_M);
  }
}

/** Appends `next` to `shown`, skipping items whose `key` is already there (or repeats within `next`). */
export function appendUniqueByKey<T extends { key: string }>(
  shown: readonly T[],
  next: readonly T[],
): T[] {
  const seen = new Set(shown.map((item) => item.key));
  const added = next.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
  return [...shown, ...added];
}
