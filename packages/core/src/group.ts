/** The tag kinds a profile can filter by (the same names as the `tag_kind` enum in the database). */
export type TagKind = 'food_type' | 'dietary' | 'personal';

/** The smallest shape the grouping and filtering helpers need; the API's `Pick` satisfies it. */
export interface PickLike {
  place: { id: string; city: string; region: string | null; country: string };
  tags: ReadonlyArray<{ kind: TagKind; slug: string; name: string }>;
}

/** A city is its name, region and country, so Vancouver, BC and Vancouver, WA stay apart. */
export function cityKey(place: { city: string; region: string | null; country: string }): string {
  return [place.city, place.region ?? '', place.country].join('|');
}

export interface PlaceGroup<P extends PickLike> {
  place: P['place'];
  picks: P[];
}

/** Groups picks by place, keeping the order in which each place first appears. */
export function groupPicksByPlace<P extends PickLike>(picks: readonly P[]): Array<PlaceGroup<P>> {
  const groups = new Map<string, PlaceGroup<P>>();
  for (const pick of picks) {
    const existing = groups.get(pick.place.id);
    if (existing) existing.picks.push(pick);
    else groups.set(pick.place.id, { place: pick.place, picks: [pick] });
  }
  return [...groups.values()];
}

/** "7 picks at 5 spots"; singular at one ("1 pick at 1 spot"). */
export function summarizeGroups(groups: ReadonlyArray<{ picks: readonly unknown[] }>): string {
  const picks = groups.reduce((total, group) => total + group.picks.length, 0);
  return `${picks} ${picks === 1 ? 'pick' : 'picks'} at ${groups.length} ${groups.length === 1 ? 'spot' : 'spots'}`;
}

export interface PickFilter {
  /** A city, as `cityKey` gives it (a city chip's `value`). */
  city?: string;
  /** The slug of a food type or dietary tag. */
  tagSlug?: string;
  /** The slug of one of the person's own tags. */
  personalTagSlug?: string;
}

/** Keeps the picks that match every given filter (none given keeps everything). */
export function filterPicks<P extends PickLike>(picks: readonly P[], filter: PickFilter): P[] {
  return picks.filter(
    (pick) =>
      (filter.city === undefined || cityKey(pick.place) === filter.city) &&
      (filter.tagSlug === undefined ||
        pick.tags.some((t) => t.kind !== 'personal' && t.slug === filter.tagSlug)) &&
      (filter.personalTagSlug === undefined ||
        pick.tags.some((t) => t.kind === 'personal' && t.slug === filter.personalTagSlug)),
  );
}

export interface ChipOption {
  kind: 'city' | 'tag';
  /** The `cityKey` for a city chip, the tag slug for a tag chip. */
  value: string;
  label: string;
  /** How many picks match. */
  count: number;
  /** For a tag chip, which kind of tag it is (a personal tag filters by `personalTagSlug`). */
  tagKind?: TagKind;
}

function byCountThenName(a: ChipOption, b: ChipOption): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

/**
 * The filter chips for a set of picks: cities, then food types, dietary tags and personal tags,
 * each group sorted by count (most first) and then name.
 */
export function chipOptions(picks: readonly PickLike[]): ChipOption[] {
  const cities = new Map<string, ChipOption & { region: string | null; country: string }>();
  const tags = new Map<string, ChipOption>();
  for (const pick of picks) {
    const key = cityKey(pick.place);
    const city = cities.get(key);
    if (city) city.count += 1;
    else {
      cities.set(key, {
        kind: 'city',
        value: key,
        label: pick.place.city,
        count: 1,
        region: pick.place.region,
        country: pick.place.country,
      });
    }
    const seen = new Set<string>();
    for (const t of pick.tags) {
      const key = `${t.kind}:${t.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const chip = tags.get(key);
      if (chip) chip.count += 1;
      else tags.set(key, { kind: 'tag', value: t.slug, label: t.name, count: 1, tagKind: t.kind });
    }
  }
  const ofKind = (kind: TagKind) =>
    [...tags.values()].filter((chip) => chip.tagKind === kind).sort(byCountThenName);
  // Two cities with the same name are told apart by region code, or country without one.
  const sameName = new Map<string, number>();
  for (const c of cities.values()) sameName.set(c.label, (sameName.get(c.label) ?? 0) + 1);
  const cityChips = [...cities.values()].map(({ region, country, ...chip }): ChipOption => {
    return (sameName.get(chip.label) ?? 0) > 1
      ? { ...chip, label: `${chip.label}, ${region || country}` }
      : chip;
  });
  return [
    ...cityChips.sort(byCountThenName),
    ...ofKind('food_type'),
    ...ofKind('dietary'),
    ...ofKind('personal'),
  ];
}
