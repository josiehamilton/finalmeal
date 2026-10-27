// Imports the GeoNames "cities15000" data set (cities with 15,000+ people) into public.cities.
// Usage: pnpm db:import-cities [-- --db-url postgresql://... ] [--cache-dir <dir>]
// Idempotent: rows are upserted by geoname_id, so re-running (or running over the dev seed)
// updates in place. Downloads are cached in a gitignored folder (default .cache/geonames).
// City data © GeoNames (CC BY 4.0), https://www.geonames.org
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import postgres from 'postgres';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'https://download.geonames.org/export/dump/';
const DEFAULT_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const BATCH_SIZE = 1000;
const MIN_EXPECTED_CITIES = 10000; // guards against importing a truncated or wrong file

const SKIPPED_FEATURE_CODES = new Set(['PPLX', 'PPLH']);

// GeoNames gives Canadian provinces and Australian states numeric admin1 codes; the label
// format wants the usual abbreviations. US admin1 codes already are the state abbreviations.
// Keys are strings on purpose (they keep their leading zero); prettier would unquote 10-14.
// prettier-ignore
const REGION_CODES = {
  CA: {
    '01': 'AB',
    '02': 'BC',
    '03': 'MB',
    '04': 'NB',
    '05': 'NL',
    '07': 'NS',
    '08': 'ON',
    '09': 'PE',
    '10': 'QC',
    '11': 'SK',
    '12': 'YT',
    '13': 'NT',
    '14': 'NU',
  },
  AU: {
    '01': 'ACT',
    '02': 'NSW',
    '03': 'NT',
    '04': 'QLD',
    '05': 'SA',
    '06': 'TAS',
    '07': 'VIC',
    '08': 'WA',
  },
};

function fail(message) {
  console.error(`db:import-cities: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = { dbUrl: DEFAULT_DB_URL, cacheDir: resolve(root, '.cache/geonames') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--db-url') opts.dbUrl = argv[++i] ?? fail('--db-url needs a value');
    else if (arg === '--cache-dir')
      opts.cacheDir = resolve(argv[++i] ?? fail('--cache-dir needs a value'));
    else fail(`unknown argument ${arg}`);
  }
  return opts;
}

async function download(name, cacheDir) {
  const path = resolve(cacheDir, name);
  if (existsSync(path)) return path;
  mkdirSync(cacheDir, { recursive: true });
  console.log(`Downloading ${name}…`);
  const res = await fetch(BASE_URL + name);
  if (!res.ok) fail(`could not download ${name} (HTTP ${res.status})`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

// Reads one named file out of a .zip (deflate or stored), using the central directory.
function readZipEntry(zipPath, entryName) {
  const buf = readFileSync(zipPath);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail(`${zipPath} is not a zip file`);
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) fail(`${zipPath} has a damaged directory`);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === entryName) {
      const dataStart =
        localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
      const data = buf.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return inflateRawSync(data).toString('utf8');
      fail(`${zipPath} uses an unsupported compression method (${method})`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return fail(`${entryName} not found in ${zipPath}`);
}

const lines = (text) => text.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#'));

function parseCountries(text) {
  const map = new Map();
  for (const line of lines(text)) {
    const cols = line.split('\t');
    map.set(cols[0], cols[4]);
  }
  return map;
}

function parseAdmin1(text) {
  const map = new Map();
  for (const line of lines(text)) {
    const cols = line.split('\t');
    map.set(cols[0], cols[1]); // "CA.02" -> "British Columbia"
  }
  return map;
}

function parseCities(text, countries, admin1) {
  const rows = [];
  for (const line of lines(text)) {
    const c = line.split('\t');
    const [
      geonameId,
      name,
      asciiName,
      ,
      lat,
      lng,
      ,
      featureCode,
      country,
      ,
      admin1Code,
      ,
      ,
      ,
      population,
    ] = c;
    if (!geonameId || !name || !country) continue;
    // Skip neighbourhoods (PPLX, e.g. "Downtown Vancouver") and historical places (PPLH): they
    // are not cities a person would call home, and they would win "nearest city".
    if (SKIPPED_FEATURE_CODES.has(featureCode)) continue;
    const regionCode =
      country === 'US' ? admin1Code || null : (REGION_CODES[country]?.[admin1Code] ?? null);
    rows.push({
      geoname_id: Number(geonameId),
      name,
      ascii_name: asciiName || name,
      region_code: regionCode,
      region_name: admin1.get(`${country}.${admin1Code}`) ?? null,
      country,
      country_name: countries.get(country) ?? country,
      population: Number(population) || 0,
      location: `SRID=4326;POINT(${Number(lng)} ${Number(lat)})`,
      _lat: Number(lat),
      _lng: Number(lng),
    });
  }
  return rows
    .filter((r) => Number.isFinite(r._lat) && Number.isFinite(r._lng))
    .map(({ _lat, _lng, ...r }) => r);
}

const columns = [
  'geoname_id',
  'name',
  'ascii_name',
  'region_code',
  'region_name',
  'country',
  'country_name',
  'population',
  'location',
];

async function main() {
  const { dbUrl, cacheDir } = parseArgs(process.argv.slice(2));

  const [zipPath, adminPath, countryPath] = await Promise.all([
    download('cities15000.zip', cacheDir),
    download('admin1CodesASCII.txt', cacheDir),
    download('countryInfo.txt', cacheDir),
  ]);
  const cities = parseCities(
    readZipEntry(zipPath, 'cities15000.txt'),
    parseCountries(readFileSync(countryPath, 'utf8')),
    parseAdmin1(readFileSync(adminPath, 'utf8')),
  );
  if (cities.length < MIN_EXPECTED_CITIES) {
    fail(
      `only ${cities.length} cities parsed (expected about 31,000); delete ${cacheDir} and retry`,
    );
  }
  console.log(`Parsed ${cities.length} cities.`);

  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  let inserted = 0;
  let updated = 0;
  try {
    for (let i = 0; i < cities.length; i += BATCH_SIZE) {
      const batch = cities.slice(i, i + BATCH_SIZE);
      const result = await sql`
        insert into public.cities ${sql(batch, ...columns)}
        on conflict (geoname_id) do update set
          name = excluded.name,
          ascii_name = excluded.ascii_name,
          region_code = excluded.region_code,
          region_name = excluded.region_name,
          country = excluded.country,
          country_name = excluded.country_name,
          population = excluded.population,
          location = excluded.location
        returning (xmax = 0) as inserted`;
      for (const row of result) row.inserted ? inserted++ : updated++;
    }
    const [{ total }] = await sql`select count(*)::int as total from public.cities`;
    console.log(
      `Imported ${cities.length} cities: ${inserted} new, ${updated} updated. Table now holds ${total}.`,
    );
  } catch (err) {
    fail(`database error: ${err.message}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => fail(err.message));
