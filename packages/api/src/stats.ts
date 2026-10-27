import type { FinalMealClient } from './client';
import { throwIfError } from './errors';

export interface FoundationStats {
  people: number;
  places: number;
  dishes: number;
  picks: number;
}

async function countRows(
  client: FinalMealClient,
  table: 'profiles' | 'places' | 'dishes' | 'picks',
): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  throwIfError(error);
  return count ?? 0;
}

export async function getFoundationStats(client: FinalMealClient): Promise<FoundationStats> {
  const [people, places, dishes, picks] = await Promise.all([
    countRows(client, 'profiles'),
    countRows(client, 'places'),
    countRows(client, 'dishes'),
    countRows(client, 'picks'),
  ]);
  return { people, places, dishes, picks };
}

function noun(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** e.g. "6 people · 14 places · 17 dishes" */
export function formatStats(s: FoundationStats): string {
  return [
    noun(s.people, 'person', 'people'),
    noun(s.places, 'place', 'places'),
    noun(s.dishes, 'dish', 'dishes'),
  ].join(' · ');
}
