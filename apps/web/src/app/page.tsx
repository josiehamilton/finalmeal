import { Foundation } from '@/components/Foundation';
import { loadStatsLine } from '@/lib/stats-line';

// Counts come from the live database, and env is read per request.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const statsLine = await loadStatsLine(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_KEY,
  );
  return <Foundation statsLine={statsLine} />;
}
