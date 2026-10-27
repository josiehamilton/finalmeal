import { Foundation } from '@/components/Foundation';
import { loadStatsLine } from '@/lib/stats-line';

// Counts come from the live database on every request. The env values below are read at request
// time under `next dev`, but Next inlines NEXT_PUBLIC_* values at build time in production builds,
// so a `next build` freezes the URL and key it was built with.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const statsLine = await loadStatsLine(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_KEY,
  );
  return <Foundation statsLine={statsLine} />;
}
