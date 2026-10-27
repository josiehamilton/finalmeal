// Tests for scripts/import-places.mjs, run on the fictional fixture (scripts/fixtures/fsq-sample.csv)
// so they need no token, no network and no database. Run with: node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts/import-places.mjs');
const fixture = join(root, 'scripts/fixtures/fsq-sample.csv');
const SECRET = 'hf_FAKE_TEST_TOKEN_0123456789';

let tmp;
before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'import-places-test-'));
});
after(() => rmSync(tmp, { recursive: true, force: true }));

function run(args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HF_TOKEN: '', ...env },
  });
  return { ...result, all: `${result.stdout}\n${result.stderr}` };
}

const noEnvFile = ['--secrets-file', join(tmpdir(), 'import-places-no-such-env-file')];

describe('fixture import to a seed file', () => {
  let out;
  let sql;
  before(() => {
    out = join(tmp, 'places_vancouver.sql');
    const r = run(['--fixture', fixture, '--bbox', 'vancouver', '--out', out, ...noEnvFile]);
    assert.equal(r.status, 0, r.all);
    sql = readFileSync(out, 'utf8');
  });

  test('writes the header and the row count', () => {
    assert.match(sql, /^-- Foursquare Open Source Places/);
    assert.match(sql, /-- Rows: 11$/m);
    assert.match(sql, /Apache License 2\.0/);
    assert.match(sql, /fsq-os-places-NOTICE\.txt/);
  });

  test('upserts by (source, source_id)', () => {
    assert.match(sql, /on conflict \(source, source_id\) do update set/);
  });

  test('the first rows match the snapshot (sorted by source id)', () => {
    const rows = sql.split('\n').filter((l) => l.startsWith("  ('fx"));
    assert.equal(rows.length, 11);
    assert.equal(
      rows[0],
      "  ('fx0001', 'Harbour Noodle House', 'Vancouver', 'BC', 'CA', 49.2827, -123.1207, " +
        "'101 Water St', 'V6B 1A1', array['fxcat-ramen','fxcat-noodle']::text[], " +
        "array['Ramen Restaurant','Noodle Restaurant']::text[], null::date),",
    );
    assert.equal(
      rows[1],
      "  ('fx0002', 'Grandma''s Pierogi, Etc.', 'Vancouver', 'BC', 'CA', 49.2634, -123.0689, " +
        "'22 Kingsway', 'V5T 3H1', array['fxcat-eastern']::text[], " +
        "array['Eastern European Restaurant']::text[], null::date),",
    );
    assert.equal(
      rows[3],
      "  ('fx0004', 'Cedar & Salt', 'Burnaby', 'BC', 'CA', 49.2201, -122.9998, " +
        "null, null, array['fxcat-seafood']::text[], array['Seafood Restaurant']::text[], null::date),",
    );
    assert.deepEqual(
      rows.map((r) => r.slice(4, 10)),
      [
        'fx0001',
        'fx0002',
        'fx0003',
        'fx0004',
        'fx0005',
        'fx0006',
        'fx0007',
        'fx0008',
        'fx0017',
        'fx0018',
        'fx0019',
      ],
    );
  });

  test('a place that is also something else keeps only its food categories', () => {
    assert.match(
      sql,
      /'Mixed Use Market'.*array\['fxcat-food'\]::text\[\], array\['Food Stand'\]::text\[\], null::date\)/,
    );
  });

  test('keeps accents, quotes and a closed date', () => {
    assert.match(sql, /'Café Étoile'/);
    assert.match(sql, /'The Old Quote "Taproom"'/);
    assert.match(sql, /'Last Call Diner'.*'2025-03-14'::date\)/);
  });

  test('skips non-food, outside the box, and unusable rows', () => {
    for (const id of ['fx0009', 'fx0010', 'fx0020'])
      assert.doesNotMatch(sql, new RegExp(id), `${id} is not food`);
    for (const id of ['fx0011', 'fx0012', 'fx0016'])
      assert.doesNotMatch(sql, new RegExp(id), `${id} is outside`);
    for (const id of ['fx0013', 'fx0014', 'fx0015'])
      assert.doesNotMatch(sql, new RegExp(id), `${id} is unusable`);
  });

  test('is deterministic, whatever order the rows arrive in', () => {
    const lines = readFileSync(fixture, 'utf8').trimEnd().split('\n');
    const reversed = join(tmp, 'reversed', 'fsq-sample.csv'); // same file name, so the same header
    mkdirSync(dirname(reversed), { recursive: true });
    writeFileSync(reversed, [lines[0], ...lines.slice(1).reverse()].join('\n') + '\n');
    const out2 = join(tmp, 'again.sql');
    const r = run(['--fixture', reversed, '--bbox', 'vancouver', '--out', out2, ...noEnvFile]);
    assert.equal(r.status, 0, r.all);
    assert.equal(readFileSync(out2, 'utf8'), sql);
  });

  test('prints the counts, including what it skipped', () => {
    const r = run([
      '--fixture',
      fixture,
      '--bbox',
      'vancouver',
      '--out',
      join(tmp, 'x.sql'),
      ...noEnvFile,
    ]);
    assert.match(r.stdout, /20 rows read/);
    assert.match(r.stdout, /11 kept/);
    assert.match(r.stdout, /3 not food/);
    assert.match(r.stdout, /3 outside the box/);
    assert.match(r.stdout, /3 unusable/);
  });
});

describe('the token', () => {
  test('is never logged on a fixture run', () => {
    const r = run(
      ['--fixture', fixture, '--bbox', 'vancouver', '--out', join(tmp, 't1.sql'), ...noEnvFile],
      {
        HF_TOKEN: SECRET,
      },
    );
    assert.equal(r.status, 0, r.all);
    assert.ok(!r.all.includes(SECRET));
    assert.ok(!readFileSync(join(tmp, 't1.sql'), 'utf8').includes(SECRET));
  });

  test('is never logged when the real extract fails (no DuckDB on the path)', () => {
    const r = run(['--bbox', 'vancouver', '--out', join(tmp, 't2.sql'), ...noEnvFile], {
      HF_TOKEN: SECRET,
      PATH: tmp, // an empty folder: no duckdb
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /DuckDB/);
    assert.ok(!r.all.includes(SECRET));
  });

  test('a missing token says the extract is pending Josie and how to add it', () => {
    const r = run(['--bbox', 'vancouver', '--out', join(tmp, 't3.sql'), ...noEnvFile]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /HF_TOKEN/);
    assert.match(r.stderr, /\.env\.local/);
  });

  test('is read from the env file', () => {
    const envFile = join(tmp, 'env.local');
    writeFileSync(envFile, `# comment\nOTHER=1\nHF_TOKEN="${SECRET}"\n`);
    const r = run(
      ['--bbox', 'vancouver', '--out', join(tmp, 't4.sql'), '--secrets-file', envFile],
      {
        PATH: tmp,
      },
    );
    // It got past the token check (and failed later, on DuckDB), without printing the token.
    assert.match(r.stderr, /DuckDB/);
    assert.ok(!r.all.includes(SECRET));
  });
});

describe('arguments', () => {
  test('--bbox only knows vancouver', () => {
    const r = run(['--fixture', fixture, '--bbox', 'atlantis', ...noEnvFile]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unknown --bbox/);
  });

  test('writing a seed file needs --bbox', () => {
    const r = run(['--fixture', fixture, '--out', join(tmp, 'n.sql'), ...noEnvFile]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--bbox/);
  });

  test('--db-url needs --bbox or --all', () => {
    const r = run(['--fixture', fixture, '--db-url', 'postgresql://x@127.0.0.1:1/x', ...noEnvFile]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--bbox.*--all|--all.*--bbox/);
  });

  test('unknown arguments are refused', () => {
    const r = run(['--nope']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /unknown argument/);
  });
});

describe('helpers', () => {
  let mod;
  before(async () => {
    mod = await import('./import-places.mjs');
  });

  test('parseCsv handles quotes, commas, doubled quotes and newlines inside fields', () => {
    const rows = mod.parseCsv('a,b,c\n1,"x, ""y""",3\n"line\nbreak",,\r\n');
    assert.deepEqual(rows, [
      ['a', 'b', 'c'],
      ['1', 'x, "y"', '3'],
      ['line\nbreak', '', ''],
    ]);
  });

  test('the DuckDB extract keeps only Dining and Drinking inside the box, and has no token', () => {
    const q = mod.buildExtractSql({
      release: 'dt=2099-01-01',
      bbox: mod.BBOXES.vancouver,
      csvPath: '/tmp/out.csv',
    });
    assert.match(q, /Dining and Drinking/);
    assert.match(q, /dt=2099-01-01\/places\/parquet/);
    assert.match(q, /49\.45/);
    assert.match(q, /-123\.35/);
    assert.doesNotMatch(q, /hf_/);
  });

  test('redact removes the token from any text', () => {
    assert.equal(mod.redact(`boom ${SECRET} and ${SECRET}`, SECRET), 'boom *** and ***');
    assert.equal(mod.redact('nothing here', ''), 'nothing here');
  });
});
