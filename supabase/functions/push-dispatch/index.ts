// push-dispatch: delivers queued pushes (public.push_outbox). Called with the service-role key
// by a schedule or `pnpm push:dispatch` (Phase 8 sets up the schedule). Phase 4 sends through
// the `log` sender; see _shared/push-sender.ts. Talks to the database through PostgREST with
// plain fetch, so it has no imports from the network.
import { senderFromEnv } from '../_shared/push-sender.ts';
import type { PushMessage } from '../_shared/push-sender.ts';

interface OutboxRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** The `role` claim of a JWT. The gateway has already checked the signature (verify_jwt). */
function jwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))).role ?? null;
  } catch {
    return null;
  }
}

function isServiceRole(request: Request, serviceKey: string): boolean {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return false;
  return token === serviceKey || jwtRole(token) === 'service_role';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'not_configured' }, 500);
  if (!isServiceRole(request, serviceKey)) return json({ error: 'unauthorized' }, 401);

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });
    if (!response.ok)
      throw new Error(`${name} failed: ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : await response.json();
  };

  try {
    const sender = senderFromEnv(Deno.env.get('PUSH_SENDER'));
    const rows: OutboxRow[] = await rpc('claim_push_batch', { p_limit: 100 });
    if (rows.length === 0) return json({ claimed: 0, sent: 0, failed: 0, sender: sender.name });

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const tokenResponse = await fetch(
      `${url}/rest/v1/push_tokens?select=user_id,expo_token&user_id=in.(${userIds.join(',')})`,
      { headers },
    );
    if (!tokenResponse.ok) throw new Error(`push_tokens failed: ${tokenResponse.status}`);
    const tokens: { user_id: string; expo_token: string }[] = await tokenResponse.json();

    // One message per token. A row is sent unless the sender failed every one of its tokens; a
    // row whose person has since lost every token has nothing to deliver and counts as failed.
    const sentIds: string[] = [];
    const failedIds: string[] = [];
    for (const row of rows) {
      const messages: PushMessage[] = tokens
        .filter((token) => token.user_id === row.user_id)
        .map((token) => ({
          to: token.expo_token,
          title: row.title,
          body: row.body,
          data: row.data,
        }));
      if (messages.length === 0) {
        failedIds.push(row.id);
        continue;
      }
      const result = await sender.send(messages);
      (result.failed >= messages.length ? failedIds : sentIds).push(row.id);
    }

    if (sentIds.length > 0) {
      await rpc('finish_push_batch', { p_ids: sentIds, p_status: 'sent', p_sender: sender.name });
    }
    if (failedIds.length > 0) {
      await rpc('finish_push_batch', {
        p_ids: failedIds,
        p_status: 'failed',
        p_sender: sender.name,
      });
    }
    return json({
      claimed: rows.length,
      sent: sentIds.length,
      failed: failedIds.length,
      sender: sender.name,
    });
  } catch (error) {
    console.error('push-dispatch failed', error);
    return json({ error: 'dispatch_failed' }, 500);
  }
});
