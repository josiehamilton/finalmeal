// Push senders for the push-dispatch Edge Function. No Deno APIs in this file, so it can be
// imported and tested anywhere. Phase 4 delivers through `log`; the Expo sender arrives in
// Phase 8 (needs Josie's Expo and Apple accounts).

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export interface PushSender {
  name: string;
  send(messages: PushMessage[]): Promise<{ ok: number; failed: number }>;
}

/** Writes one line per message to the function's log and reports every message as sent. */
export const logSender: PushSender = {
  name: 'log',
  async send(messages) {
    for (const message of messages) {
      console.log(`[push:log] ${message.to} ${message.title}: ${message.body}`);
    }
    return { ok: messages.length, failed: 0 };
  },
};

/** Sends nothing and reports every message as sent (for switching delivery off). */
export const noopSender: PushSender = {
  name: 'noop',
  async send(messages) {
    return { ok: messages.length, failed: 0 };
  },
};

let warnedAboutExpo = false;

/**
 * Picks a sender from the PUSH_SENDER secret: `log` (also the default), `noop`. `expo` and any
 * unknown value fall back to `log`, with a one-time warning.
 */
export function senderFromEnv(value: string | undefined): PushSender {
  const name = (value ?? '').trim().toLowerCase();
  if (name === 'noop') return noopSender;
  if (name === '' || name === 'log') return logSender;
  if (!warnedAboutExpo) {
    warnedAboutExpo = true;
    console.warn('Expo sender arrives in Phase 8; using log');
  }
  return logSender;
}
