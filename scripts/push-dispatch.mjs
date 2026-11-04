// Runs the push-dispatch Edge Function once against the local Supabase and prints its JSON
// reply, e.g. { "claimed": 1, "sent": 1, "failed": 0, "sender": "log" }. With the default `log`
// sender the messages appear in the edge runtime's log: docker logs supabase_edge_runtime_finalmeal
// Usage: pnpm push:dispatch (Supabase must be running: pnpm db:start). Never prints keys.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const supabaseBin = resolve(root, 'node_modules/.bin/supabase');

function fail(message) {
  console.error(`push:dispatch: ${message}`);
  process.exit(1);
}

function readStatus() {
  let stdout;
  try {
    stdout = execFileSync(supabaseBin, ['status', '-o', 'json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    fail('could not read local Supabase status. Is it running? Start it with: pnpm db:start');
  }
  // The CLI can print warnings before the JSON, so parse from the first brace.
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1) fail('Supabase is not running (no status output).');
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    fail('could not parse `supabase status -o json` output.');
  }
}

const status = readStatus();
const url = status.API_URL;
// The legacy JWT key first: the gateway's verify_jwt check rejects the `sb_secret_...` key.
const key = status.SERVICE_ROLE_KEY || status.SECRET_KEY;
if (!url || !key) fail('Supabase status has no API_URL or service key. Try: pnpm db:start');

let response;
try {
  response = await fetch(`${url}/functions/v1/push-dispatch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
} catch {
  fail('could not reach the function. Is the stack running? Try: pnpm db:stop && pnpm db:start');
}
const text = await response.text();
console.log(text);
if (!response.ok) {
  if (response.status === 404) {
    console.error(
      'push:dispatch: the function is not served. Restart the stack (pnpm db:stop && pnpm db:start) or run: pnpm exec supabase functions serve',
    );
  }
  process.exit(1);
}
