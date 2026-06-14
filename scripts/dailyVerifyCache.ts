import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DailyVerifyEntry {
  date: string;
  par: number;
  states: number;
  width: number;
  height: number;
  solution: string;
  defHash: string;
  verifiedAt: string;
}

export interface DailyVerifyCache {
  fp: string;
  days: Record<string, DailyVerifyEntry>;
}

const FINGERPRINT_SCHEMA = 'daily-verify-v1';

export function emptyDailyVerifyCache(fp: string): DailyVerifyCache {
  return { fp, days: {} };
}

export function hashDailyDef(def: unknown): string {
  return createHash('sha1').update(JSON.stringify(def)).digest('hex');
}

export function dailyVerifyFingerprint(root = process.cwd()): string {
  const h = createHash('sha1');
  h.update(FINGERPRINT_SCHEMA);
  h.update('\0');
  for (const file of fingerprintFiles(root)) {
    h.update(file);
    h.update('\0');
    h.update(readFileSync(file));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 12);
}

export function loadDailyVerifyCache(file: string, fp: string): DailyVerifyCache {
  try {
    if (!existsSync(file)) return emptyDailyVerifyCache(fp);
    const cache = JSON.parse(readFileSync(file, 'utf8')) as DailyVerifyCache;
    if (cache.fp === fp && cache.days && typeof cache.days === 'object') return cache;
  } catch {
    /* corrupt or half-written cache: recompute, never trust */
  }
  return emptyDailyVerifyCache(fp);
}

export function saveDailyVerifyCache(file: string, cache: DailyVerifyCache): void {
  writeFileSync(file, JSON.stringify(cache, null, 2) + '\n');
}

function fingerprintFiles(root: string): string[] {
  const engine = tsFiles(join(root, 'src', 'engine'));
  const gen = tsFiles(join(root, 'src', 'gen'));
  return [
    ...engine,
    ...gen,
    join(root, 'src', 'levels.json')
  ].filter((file) => existsSync(file)).sort();
}

function tsFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}
