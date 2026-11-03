// Tests for scripts/import-cities.mjs argument handling. They fail before any download or
// database connection, so they need no network. Run with: node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/import-cities.mjs');

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: '', ...env },
  });
  return { ...result, all: `${result.stdout}\n${result.stderr}` };
}

describe('import-cities arguments', () => {
  test('--db-url is gone, and the refusal does not echo its value', () => {
    const r = run(['--db-url', 'postgresql://u:URLSECRET@h/db']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /DATABASE_URL/);
    assert.ok(!r.all.includes('URLSECRET'), r.all);
  });

  test('--db-url=value is refused without echoing the value', () => {
    const r = run(['--db-url=postgresql://u:URLSECRET@h/db']);
    assert.notEqual(r.status, 0);
    assert.ok(!r.all.includes('URLSECRET'), r.all);
  });

  test('an unknown argument is refused without echoing it', () => {
    const r = run(['--nope=hunter2']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unknown argument/);
    assert.ok(!r.all.includes('hunter2'), r.all);
  });

  test('a DATABASE_URL that is not a connection string is refused without echoing it', () => {
    const r = run([], { DATABASE_URL: 'not a url URLSECRET' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /DATABASE_URL/);
    assert.ok(!r.all.includes('URLSECRET'), r.all);
  });
});
