/** Test helper: reads sign-in codes from the local Mailpit inbox (started by `pnpm db:start`). */

const MAILPIT = 'http://127.0.0.1:54324/api/v1';
const POLL_EVERY_MS = 250;
const GIVE_UP_AFTER_MS = 5000;

interface MessageSummary {
  ID: string;
  Created: string;
  To: Array<{ Address: string }>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${MAILPIT}${path}`);
  if (!res.ok) throw new Error(`Mailpit ${path} answered ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Waits up to 5 seconds for a sign-in email to `email` and returns its 6-digit code.
 * `sinceMs` ignores older messages (use `Date.now()` taken just before sending, minus a
 * little slack, when the same address may already have mail from an earlier run).
 */
export async function readLatestCode(email: string, sinceMs = 0): Promise<string> {
  const wanted = email.trim().toLowerCase();
  const deadline = Date.now() + GIVE_UP_AFTER_MS;
  for (;;) {
    const { messages } = await getJson<{ messages: MessageSummary[] }>('/messages');
    // Mailpit lists newest first.
    const hit = messages.find(
      (m) =>
        m.To.some((t) => t.Address.toLowerCase() === wanted) && Date.parse(m.Created) >= sinceMs,
    );
    if (hit) {
      const full = await getJson<{ Text: string }>(`/message/${hit.ID}`);
      const code = /\b(\d{6})\b/.exec(full.Text)?.[1];
      if (code) return code;
    }
    if (Date.now() >= deadline) {
      throw new Error(`No sign-in code arrived in Mailpit for ${email} within 5 seconds.`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
  }
}
