import { createFinalMealClient, formatStats, getFoundationStats } from '@finalmeal/api';

/**
 * The "7 people · 14 places · 22 dishes" line, or null when it cannot be produced
 * (env not set, API unreachable, query failed). Never throws, so the page always renders.
 */
export async function loadStatsLine(
  url: string | undefined,
  key: string | undefined,
): Promise<string | null> {
  if (!url || !key) return null;
  try {
    return formatStats(await getFoundationStats(createFinalMealClient({ url, key })));
  } catch {
    return null;
  }
}
