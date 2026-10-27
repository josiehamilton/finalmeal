// Imports Foursquare Open Source Places (FSQ OS Places) into public.places.
//
// Usage:
//   node scripts/import-places.mjs --bbox vancouver              write supabase/seed/places_vancouver.sql
//   DATABASE_URL=<url> node scripts/import-places.mjs --upsert --bbox vancouver   upsert Metro Vancouver
//   DATABASE_URL=<url> node scripts/import-places.mjs --upsert --all              upsert every place (production)
//   The target database comes from the DATABASE_URL environment variable only (there is no
//   command-line flag for it, so a connection string with a password never ends up in shell
//   history or the process list). For the local database:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
//   add --fixture <csv> to read a local CSV instead of Hugging Face (tests and CI; no token)
//   other flags: --out <file> (the seed file to write), --secrets-file <file> (default .env.local),
//                --release dt=YYYY-MM-DD (default: the newest release folder)
//   pnpm db:import-places -- <the same flags>
//
// Source: the Hugging Face mirror of the dataset, hf://datasets/foursquare/fsq-os-places/, read
// with DuckDB (the `duckdb` command line program, e.g. `brew install duckdb`). The mirror needs
// Josie's Hugging Face token: HF_TOKEN in the root .env.local (or the environment). The token is
// passed to DuckDB on its standard input as a secret; it is never put on a command line, printed,
// or written to any file, and any error text is scrubbed of it before it is shown.
//
// Category filter: only places with a category under the top-level "Dining and Drinking" in
// fsq_category_labels (labels look like "Dining and Drinking > Restaurant > Ramen Restaurant").
// That covers restaurants, cafes, bars, bakeries, food trucks and so on. Before it extracts, the
// script checks that the release's categories file (release/<dt>/categories/parquet/) still has
// a "Dining and Drinking" branch, and stops if it does not, so a renamed taxonomy cannot
// silently produce an empty or wrong extract.
//
// Mapping to public.places: fsq_place_id -> source_id (source 'fsq'); name; locality -> city;
// region -> region; country -> country; latitude/longitude -> location; address; postcode;
// fsq_category_ids -> category_ids; the last part of each fsq_category_labels entry ("Ramen
// Restaurant") -> category_labels; date_closed -> closed_at. Rows with no id, name, city, a
// two-letter country or usable coordinates are skipped and counted.
//
// Changes: filtered to Dining and Drinking categories; fields mapped to Final Meal's places table.
// (This is the notice of changes the Apache License 2.0, section 4(b), asks for. The same line
// is written into the header of every generated seed file.)
//
// The seed file is sorted by fsq_place_id and has no timestamps, so regenerating from the same
// release gives the same bytes. Re-running a database import is safe (upsert by source and
// source_id).
//
// FSQ OS Places: © Foursquare Labs, Inc., Apache License 2.0. See
// docs/third-party/fsq-os-places-NOTICE.txt and docs/third-party/fsq-os-places-LICENSE.txt.
import { spawnSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const BBOXES = {
  // Metro Vancouver
  vancouver: { minLat: 49.0, maxLat: 49.45, minLng: -123.35, maxLng: -122.5 },
};

export const FOOD_TOP_CATEGORY = 'Dining and Drinking';
const HF_DATASET = 'foursquare/fsq-os-places';
const HF_API_TREE = `https://huggingface.co/api/datasets/${HF_DATASET}/tree/main/release`;
const DEFAULT_OUT = resolve(root, 'supabase/seed/places_vancouver.sql');
const DEFAULT_ENV_FILE = resolve(root, '.env.local');
const SEED_BATCH_SIZE = 500;
const DB_BATCH_SIZE = 1000;

// ---------------------------------------------------------------- errors and the token
// Everything secret this run has seen (the Hugging Face token, the database URL and its
// password). Anything printed goes through redact() first.
const secrets = [];
const addSecret = (s) => {
  if (s) secrets.push(s);
};

export function redact(text, hidden) {
  let s = String(text);
  for (const h of [hidden].flat()) {
    if (h) s = s.split(h).join('***');
  }
  return s;
}

function fail(message) {
  console.error(`db:import-places: ${redact(message, secrets)}`);
  process.exit(1);
}

// ---------------------------------------------------------------- arguments
function parseArgs(argv) {
  const opts = {
    fixture: null,
    bbox: null,
    all: false,
    upsert: false,
    out: DEFAULT_OUT,
    envFile: DEFAULT_ENV_FILE,
    release: null,
  };
  const value = (i, flag) => argv[i + 1] ?? fail(`${flag} needs a value`);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    else if (arg === '--fixture') opts.fixture = resolve(value(i++, arg));
    else if (arg === '--bbox') opts.bbox = value(i++, arg);
    else if (arg === '--all') opts.all = true;
    else if (arg === '--upsert') opts.upsert = true;
    else if (arg === '--out') opts.out = resolve(value(i++, arg));
    else if (arg === '--secrets-file') opts.envFile = resolve(value(i++, arg));
    else if (arg === '--release') opts.release = value(i++, arg);
    else fail('unknown argument (see the usage at the top of scripts/import-places.mjs)');
  }
  if (opts.bbox !== null && !BBOXES[opts.bbox]) {
    fail(`unknown --bbox (known: ${Object.keys(BBOXES).join(', ')})`);
  }
  if (opts.bbox !== null && opts.all) fail('use --bbox or --all, not both');
  if (opts.upsert && opts.bbox === null && !opts.all) {
    fail('--upsert needs --bbox vancouver or --all (to say how much to import)');
  }
  if (!opts.upsert && opts.bbox === null) {
    fail('give --bbox vancouver to write the seed file, or --upsert with --bbox/--all');
  }
  if (opts.upsert) {
    const dbUrl = (process.env.DATABASE_URL ?? '').trim();
    if (!dbUrl) {
      fail(
        'DATABASE_URL is not set. Set it to the target database, e.g. for the local one ' +
          'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      );
    }
    addSecret(dbUrl);
    try {
      addSecret(decodeURIComponent(new URL(dbUrl).password));
      addSecret(new URL(dbUrl).password);
    } catch {
      fail('DATABASE_URL is not a valid connection string');
    }
    opts.dbUrl = dbUrl;
  }
  if (opts.release !== null && !/^dt=\d{4}-\d{2}-\d{2}$/.test(opts.release)) {
    fail('--release looks like dt=2026-01-01');
  }
  return opts;
}

// ---------------------------------------------------------------- CSV
// A small streaming RFC 4180 reader: quoted fields may hold commas, doubled quotes and newlines.
class CsvParser {
  rows = [];
  #row = [];
  #field = '';
  #quoted = false;
  #inQuotes = false;
  #quoteSeen = false; // a quote inside a quoted field: either an escaped quote or the end

  push(chunk) {
    for (const ch of chunk) this.#char(ch);
    const rows = this.rows;
    this.rows = [];
    return rows;
  }

  end() {
    this.#inQuotes = false;
    this.#quoteSeen = false;
    this.#endRow();
    const rows = this.rows;
    this.rows = [];
    return rows;
  }

  #char(ch) {
    if (this.#quoteSeen) {
      this.#quoteSeen = false;
      if (ch === '"') {
        this.#field += '"';
        return;
      }
      this.#inQuotes = false;
    }
    if (this.#inQuotes) {
      if (ch === '"') this.#quoteSeen = true;
      else this.#field += ch;
    } else if (ch === '"' && this.#field === '' && !this.#quoted) {
      this.#inQuotes = true;
      this.#quoted = true;
    } else if (ch === ',') {
      this.#endField();
    } else if (ch === '\n') {
      this.#endRow();
    } else if (ch !== '\r') {
      this.#field += ch;
    }
  }

  #endField() {
    this.#row.push(this.#field);
    this.#field = '';
    this.#quoted = false;
  }

  #endRow() {
    if (this.#row.length === 0 && this.#field === '' && !this.#quoted) return; // blank line
    this.#endField();
    this.rows.push(this.#row);
    this.#row = [];
  }
}

export function parseCsv(text) {
  const parser = new CsvParser();
  return [...parser.push(text), ...parser.end()];
}

async function* readCsvRecords(path) {
  const parser = new CsvParser();
  let header = null;
  function* records(rows) {
    for (const row of rows) {
      if (header === null) {
        header = row.map((h) => h.trim());
        const missing = ['fsq_place_id', 'name', 'latitude', 'longitude', 'country'].filter(
          (c) => !header.includes(c),
        );
        if (missing.length > 0) fail(`${basename(path)} has no ${missing.join(', ')} column`);
      } else {
        yield Object.fromEntries(header.map((h, i) => [h, row[i] ?? '']));
      }
    }
  }
  for await (const chunk of createReadStream(path, { encoding: 'utf8' })) {
    yield* records(parser.push(chunk));
  }
  yield* records(parser.end());
}

// ---------------------------------------------------------------- one record -> one place
const blankToNull = (s) => {
  const t = String(s ?? '').trim();
  return t === '' ? null : t;
};

function jsonList(s) {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x !== '') : [];
  } catch {
    return [];
  }
}

const inBox = (box, lat, lng) =>
  lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;

// Returns { row } for a place to keep, or { skip: 'unusable' | 'not food' | 'outside' }.
export function toPlace(rec, box) {
  const sourceId = blankToNull(rec.fsq_place_id);
  const name = blankToNull(rec.name);
  const city = blankToNull(rec.locality);
  const country = (blankToNull(rec.country) ?? '').toUpperCase();
  const lat = rec.latitude === '' || rec.latitude == null ? NaN : Number(rec.latitude);
  const lng = rec.longitude === '' || rec.longitude == null ? NaN : Number(rec.longitude);
  if (
    !sourceId ||
    !name ||
    !city ||
    !/^[A-Z]{2}$/.test(country) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return { skip: 'unusable' };
  }
  const labels = jsonList(rec.fsq_category_labels);
  if (!labels.some((l) => l === FOOD_TOP_CATEGORY || l.startsWith(`${FOOD_TOP_CATEGORY} >`))) {
    return { skip: 'not food' };
  }
  if (box && !inBox(box, lat, lng)) return { skip: 'outside' };
  // The ids and labels are parallel lists; a place that is also, say, a grocery store keeps only
  // its food categories (when the lists do not line up, everything is kept).
  const isFood = (l) => l === FOOD_TOP_CATEGORY || l.startsWith(`${FOOD_TOP_CATEGORY} >`);
  let ids = jsonList(rec.fsq_category_ids);
  let foodLabels = labels;
  if (ids.length === labels.length) {
    ids = ids.filter((_, i) => isFood(labels[i]));
    foodLabels = labels.filter(isFood);
  }
  const leaves = [...new Set(foodLabels.map((l) => l.split(' > ').pop().trim()).filter(Boolean))];
  const closed = /^\d{4}-\d{2}-\d{2}/.test(rec.date_closed ?? '')
    ? rec.date_closed.slice(0, 10)
    : null;
  return {
    row: {
      source_id: sourceId,
      name,
      city,
      region: blankToNull(rec.region),
      country,
      lat,
      lng,
      address: blankToNull(rec.address),
      postcode: blankToNull(rec.postcode),
      category_ids: ids,
      category_labels: leaves,
      closed_at: closed,
    },
  };
}

async function* places(recordStream, box, counts) {
  for await (const rec of recordStream) {
    counts.read++;
    const r = toPlace(rec, box);
    if (r.row) {
      counts.kept++;
      yield r.row;
    } else {
      counts[r.skip]++;
    }
  }
}

function summary(counts) {
  return (
    `${counts.read} rows read: ${counts.kept} kept, ${counts['not food']} not food, ` +
    `${counts.outside} outside the box, ${counts.unusable} unusable.`
  );
}

// ---------------------------------------------------------------- the seed file
const lit = (s) =>
  s === null ? 'null' : `'${String(s).replaceAll('\0', '').replaceAll("'", "''")}'`;
const arr = (a) => (a.length === 0 ? 'array[]::text[]' : `array[${a.map(lit).join(',')}]::text[]`);

function valuesRow(r) {
  return (
    `  (${lit(r.source_id)}, ${lit(r.name)}, ${lit(r.city)}, ${lit(r.region)}, ${lit(r.country)}, ` +
    `${r.lat}, ${r.lng}, ${lit(r.address)}, ${lit(r.postcode)}, ${arr(r.category_ids)}, ` +
    `${arr(r.category_labels)}, ${r.closed_at ? `${lit(r.closed_at)}::date` : 'null::date'})`
  );
}

const UPSERT_COLUMNS = [
  'name',
  'city',
  'region',
  'country',
  'location',
  'address',
  'postcode',
  'category_ids',
  'category_labels',
  'closed_at',
];

export function renderSeedSql(rows, { description, boxName }) {
  const sorted = [...rows].sort((a, b) =>
    a.source_id < b.source_id ? -1 : a.source_id > b.source_id ? 1 : 0,
  );
  const out = [
    `-- Foursquare Open Source Places: ${boxName ? `the ${boxName} box, ` : ''}${FOOD_TOP_CATEGORY} categories only.`,
    '-- Generated by scripts/import-places.mjs; do not edit by hand.',
    "-- Changes: filtered to Dining and Drinking categories; fields mapped to Final Meal's places table.",
    `-- Source: ${description}`,
    `-- Rows: ${sorted.length}`,
    '--',
    `-- Regenerate (needs HF_TOKEN in the root .env.local and the duckdb program):`,
    `--   pnpm db:import-places -- --bbox ${boxName ?? 'vancouver'}`,
    '--',
    '-- Loaded by supabase/config.toml after seed.sql, which holds the canvas places.',
    '-- FSQ OS Places © Foursquare Labs, Inc., Apache License 2.0; see',
    '-- docs/third-party/fsq-os-places-NOTICE.txt and docs/third-party/fsq-os-places-LICENSE.txt.',
    '',
  ];
  for (let i = 0; i < sorted.length; i += SEED_BATCH_SIZE) {
    const batch = sorted.slice(i, i + SEED_BATCH_SIZE);
    out.push(
      'insert into public.places',
      '  (source, source_id, name, city, region, country, location, address, postcode,',
      '   category_ids, category_labels, closed_at)',
      'select',
      "  'fsq', v.source_id, v.name, v.city, v.region, v.country,",
      '  extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography,',
      '  v.address, v.postcode, v.category_ids, v.category_labels, v.closed_at',
      'from (values',
      batch.map(valuesRow).join(',\n'),
      ') as v(source_id, name, city, region, country, lat, lng, address, postcode,',
      '       category_ids, category_labels, closed_at)',
      'where true',
      'on conflict (source, source_id) do update set',
      UPSERT_COLUMNS.map((c) => `  ${c} = excluded.${c}`).join(',\n') + ';',
      '',
    );
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- the database
async function upsertPlaces(rowStream, dbUrl) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  let inserted = 0;
  let updated = 0;
  async function flush(batch) {
    const result = await sql`
      insert into public.places
        (source, source_id, name, city, region, country, location, address, postcode,
         category_ids, category_labels, closed_at)
      select
        'fsq', x.source_id, x.name, x.city, x.region, x.country,
        extensions.st_setsrid(extensions.st_makepoint(x.lng, x.lat), 4326)::extensions.geography,
        x.address, x.postcode, x.category_ids, x.category_labels, x.closed_at
      from jsonb_to_recordset(${sql.json(batch)}) as x(
        source_id text, name text, city text, region text, country text,
        lat double precision, lng double precision, address text, postcode text,
        category_ids text[], category_labels text[], closed_at date)
      on conflict (source, source_id) do update set
        ${sql.unsafe(UPSERT_COLUMNS.map((c) => `${c} = excluded.${c}`).join(', '))}
      returning (xmax = 0) as inserted`;
    for (const r of result) r.inserted ? inserted++ : updated++;
  }
  try {
    let batch = [];
    for await (const row of rowStream) {
      batch.push(row);
      if (batch.length >= DB_BATCH_SIZE) {
        await flush(batch);
        batch = [];
      }
    }
    if (batch.length > 0) await flush(batch);
    const [{ total }] = await sql`select count(*)::int as total from public.places`;
    console.log(`Imported places: ${inserted} new, ${updated} updated. Table now holds ${total}.`);
  } catch (err) {
    fail(`database error: ${err.message}`);
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------- the real source (DuckDB)
function readToken(envFile) {
  if (process.env.HF_TOKEN) return process.env.HF_TOKEN.trim();
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^\s*HF_TOKEN\s*=\s*(.*?)\s*$/);
      if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return '';
}

const sqlStr = (s) => `'${String(s).replaceAll("'", "''")}'`;
const hfPath = (release, folder) =>
  `hf://datasets/${HF_DATASET}/release/${release}/${folder}/parquet/*.parquet`;

export function buildSecretSql(token) {
  return `INSTALL httpfs; LOAD httpfs;\nCREATE SECRET hf_secret (TYPE HUGGINGFACE, TOKEN ${sqlStr(token)});\n`;
}

export function buildCategoryCheckSql({ release }) {
  return (
    `SELECT count(*) FROM read_parquet(${sqlStr(hfPath(release, 'categories'))}) ` +
    `WHERE category_label = ${sqlStr(FOOD_TOP_CATEGORY)} ` +
    `OR category_label LIKE ${sqlStr(`${FOOD_TOP_CATEGORY} > %`)};\n`
  );
}

export function buildExtractSql({ release, bbox, csvPath }) {
  const where = [
    `country IS NOT NULL`,
    `latitude IS NOT NULL AND longitude IS NOT NULL`,
    `len(list_filter(fsq_category_labels, l -> l = ${sqlStr(FOOD_TOP_CATEGORY)} OR l LIKE ${sqlStr(`${FOOD_TOP_CATEGORY} > %`)})) > 0`,
  ];
  if (bbox) {
    where.push(
      `latitude BETWEEN ${bbox.minLat} AND ${bbox.maxLat}`,
      `longitude BETWEEN ${bbox.minLng} AND ${bbox.maxLng}`,
    );
  }
  return (
    `COPY (\n` +
    `  SELECT fsq_place_id, name, latitude, longitude, address, locality, region, postcode, country,\n` +
    `         to_json(fsq_category_ids)::VARCHAR AS fsq_category_ids,\n` +
    `         to_json(fsq_category_labels)::VARCHAR AS fsq_category_labels,\n` +
    `         date_closed\n` +
    `  FROM read_parquet(${sqlStr(hfPath(release, 'places'))})\n` +
    `  WHERE ${where.join('\n    AND ')}\n` +
    `  ORDER BY fsq_place_id\n` +
    `) TO ${sqlStr(csvPath)} (HEADER, FORMAT csv);\n`
  );
}

function runDuckDb(script, token, extraArgs = []) {
  const r = spawnSync('duckdb', ['-bail', ...extraArgs], {
    input: script,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) {
    if (r.error.code === 'ENOENT') {
      fail(
        'DuckDB is not installed. Install the duckdb command line program (brew install duckdb).',
      );
    }
    fail(`could not run DuckDB: ${redact(r.error.message, token)}`);
  }
  if (r.status !== 0) {
    fail(`DuckDB failed:\n${redact(`${r.stderr}${r.stdout}`, token).slice(0, 2000)}`);
  }
  return r.stdout;
}

async function latestRelease(token) {
  let res;
  try {
    res = await fetch(HF_API_TREE, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    fail(`could not reach Hugging Face: ${err.message}`);
  }
  if (res.status === 401 || res.status === 403)
    fail('Hugging Face refused the HF_TOKEN (HTTP ' + res.status + ').');
  if (!res.ok) fail(`could not list the dataset releases (HTTP ${res.status})`);
  const dirs = (await res.json())
    .map((e) => e.path?.split('/').pop())
    .filter((n) => /^dt=\d{4}-\d{2}-\d{2}$/.test(n ?? ''))
    .sort();
  if (dirs.length === 0) fail('no release folder found in the dataset');
  return dirs.at(-1);
}

// Extracts the Dining and Drinking places (inside the box, if any) to a CSV and returns its path.
async function extractFromHuggingFace(opts, box, workDir) {
  const token = readToken(opts.envFile);
  addSecret(token);
  if (!token) {
    fail(
      'HF_TOKEN is not set. Add HF_TOKEN=<your Hugging Face token> to the root .env.local ' +
        '(Hugging Face > Settings > Access Tokens), or run with --fixture <csv>. ' +
        'Generating the real extract is pending Josie.',
    );
  }
  runDuckDb('SELECT 1;\n', token); // fails early, and without network, if DuckDB is missing
  const release = opts.release ?? (await latestRelease(token));
  console.log(`Using release ${release}.`);
  const secretSql = buildSecretSql(token);
  const check = runDuckDb(secretSql + buildCategoryCheckSql({ release }), token, [
    '-csv',
    '-noheader',
  ]);
  if (!(Number(check.trim().split('\n').at(-1)) > 0)) {
    fail(
      `the ${release} categories file has no "${FOOD_TOP_CATEGORY}" category; the taxonomy may have ` +
        'changed. Check the categories file and update FOOD_TOP_CATEGORY in this script.',
    );
  }
  const csvPath = join(workDir, 'places.csv');
  console.log('Reading places from Hugging Face (this can take a few minutes)…');
  runDuckDb(secretSql + buildExtractSql({ release, bbox: box, csvPath }), token);
  return { csvPath, description: `Foursquare OS Places, release ${release}` };
}

// ---------------------------------------------------------------- main
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const box = opts.bbox ? BBOXES[opts.bbox] : null;
  const counts = { read: 0, kept: 0, 'not food': 0, outside: 0, unusable: 0 };
  const workDir = mkdtempSync(join(tmpdir(), 'import-places-'));
  try {
    let csvPath;
    let description;
    if (opts.fixture) {
      if (!existsSync(opts.fixture)) fail(`fixture ${opts.fixture} not found`);
      csvPath = opts.fixture;
      description = `fixture ${basename(opts.fixture)}`;
    } else {
      ({ csvPath, description } = await extractFromHuggingFace(opts, box, workDir));
    }
    const stream = places(readCsvRecords(csvPath), box, counts);

    if (opts.upsert) {
      await upsertPlaces(stream, opts.dbUrl);
    } else {
      const byId = new Map();
      for await (const row of stream) byId.set(row.source_id, row);
      const sql = renderSeedSql([...byId.values()], { description, boxName: opts.bbox });
      mkdirSync(dirname(opts.out), { recursive: true });
      await writeFile(opts.out, sql);
      console.log(`Wrote ${byId.size} places to ${opts.out}.`);
    }
    console.log(summary(counts));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => fail(err.message));
}
