/* Real App Store download numbers for the iOS build, straight from App Store
   Connect - the counterpart to the in-game anonymous counters (which cannot see
   installs at all, only plays).

   Apple ships this as a gzipped TSV behind an ES256-signed JWT. The column that
   matters is "Product Type Identifier": 1F/3F are free first-time downloads,
   7F is an update or re-download and must NEVER be counted as a new user.

   The daily report lags ~1 day, so the newest available date is yesterday.

   Usage: npm run ios:units [daysBack] */
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { gunzipSync } from 'node:zlib';

const KEY_ID = 'FJW7WA846Q';
const ISSUER = '69a6de8b-d55a-47e3-e053-5b8c7c11a4d1';
const VENDOR = '87076202';
const KEY_PATH = `${homedir()}/.claude/keys/AuthKey_${KEY_ID}.p8`;
const SKU = 'squish-ios';
const DAY_MS = 86_400_000;
/** free first-time downloads; 7F (update/re-download) is deliberately excluded */
const DOWNLOAD_TYPES = new Set(['1F', '3F']);

interface UnitRow { date: string; type: string; units: number; country: string }

function encode(part: object): string {
  return Buffer.from(JSON.stringify(part)).toString('base64url');
}

/** Short-lived App Store Connect JWT. dsaEncoding gives us JOSE r||s directly. */
function mintToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const head = encode({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' });
  const body = encode({ iss: ISSUER, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' });
  const signer = createSign('SHA256');
  signer.update(`${head}.${body}`);
  const key = readFileSync(KEY_PATH, 'utf8');
  const sig = signer.sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

function reportUrl(date: string): string {
  const url = new URL('https://api.appstoreconnect.apple.com/v1/salesReports');
  url.searchParams.set('filter[frequency]', 'DAILY');
  url.searchParams.set('filter[reportType]', 'SALES');
  url.searchParams.set('filter[reportSubType]', 'SUMMARY');
  url.searchParams.set('filter[vendorNumber]', VENDOR);
  url.searchParams.set('filter[reportDate]', date);
  return url.toString();
}

function parseReport(date: string, tsv: string): UnitRow[] {
  const lines = tsv.trim().split('\n');
  const head = (lines[0] ?? '').split('\t');
  const cell = (cols: string[], name: string): string => cols[head.indexOf(name)] ?? '';
  return lines.slice(1)
    .map((line) => line.split('\t'))
    .filter((c) => cell(c, 'SKU') === SKU)
    .map((c) => ({
      date,
      type: cell(c, 'Product Type Identifier'),
      units: Number(cell(c, 'Units')),
      country: cell(c, 'Country Code')
    }));
}

async function fetchDay(date: string, jwt: string): Promise<UnitRow[]> {
  const res = await fetch(reportUrl(date), {
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/a-gzip' }
  });
  /* 404 = no sales that day, which is a normal answer, not an error */
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`App Store Connect ${res.status} for ${date}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return parseReport(date, gunzipSync(buf).toString('utf8'));
}

function daysBackFrom(count: number): string[] {
  const newest = Date.now() - DAY_MS;
  return Array.from({ length: count }, (_, i) =>
    new Date(newest - (count - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

function tally(rows: UnitRow[], key: (r: UnitRow) => string): [string, number][] {
  const acc = new Map<string, number>();
  for (const r of rows) acc.set(key(r), (acc.get(key(r)) ?? 0) + r.units);
  return [...acc.entries()].sort((a, b) => b[1] - a[1]);
}

async function main(): Promise<void> {
  const days = daysBackFrom(Number(process.argv[2] ?? 60));
  const jwt = mintToken();
  const rows: UnitRow[] = [];
  for (const day of days) rows.push(...await fetchDay(day, jwt));

  const downloads = rows.filter((r) => DOWNLOAD_TYPES.has(r.type));
  const total = downloads.reduce((n, r) => n + r.units, 0);
  const updates = rows.filter((r) => !DOWNLOAD_TYPES.has(r.type))
    .reduce((n, r) => n + r.units, 0);

  console.info(`${SKU}  ${days[0]} .. ${days[days.length - 1]}  (${days.length} days)`);
  console.info(`downloads (1F+3F): ${total}   updates/re-downloads: ${updates}`);
  console.info(`per day: ${(total / days.length).toFixed(2)}`);
  console.info('\nby country:');
  for (const [country, n] of tally(downloads, (r) => r.country)) console.info(`  ${country}  ${n}`);
  console.info('\nby day:');
  for (const [date, n] of tally(downloads, (r) => r.date).sort()) console.info(`  ${date}  ${n}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
