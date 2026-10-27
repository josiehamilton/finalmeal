// Writes the gitignored env files the apps and API tests need, from the running local Supabase.
// Usage: pnpm env:local (Supabase must be running: pnpm db:start). Never prints keys.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The Supabase CLI is pinned in the root package.json, so always use that copy.
const supabaseBin = resolve(root, 'node_modules/.bin/supabase');

function fail(message) {
  console.error(`env:local: ${message}`);
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
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      fail('the Supabase CLI is not installed. Run: pnpm install');
    }
    fail('could not read local Supabase status. Is it running? Start it with: pnpm db:start');
  }
  // The CLI can print warnings before the JSON, so parse from the first brace.
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1) {
    fail('Supabase is not running (no status output). Start it with: pnpm db:start');
  }
  try {
    return JSON.parse(stdout.slice(start, end + 1));
  } catch {
    fail('could not parse `supabase status -o json` output.');
  }
}

const status = readStatus();
const url = status.API_URL;
const key = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!url || !key) {
  fail('Supabase status has no API_URL or key. Is the stack fully started? Try: pnpm db:start');
}

const targets = [
  ['apps/web/.env.local', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_KEY'],
  ['apps/mobile/.env.local', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_KEY'],
  ['packages/api/.env.test.local', 'SUPABASE_URL', 'SUPABASE_KEY'],
];

for (const [file, urlName, keyName] of targets) {
  const path = resolve(root, file);
  // apps/web and apps/mobile may not exist yet; create them so the file is ready when they do.
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${urlName}=${url}\n${keyName}=${key}\n`);
  console.log(`wrote ${file}`);
}
