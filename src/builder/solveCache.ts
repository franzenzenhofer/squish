import type { LevelDef } from '../engine/types';
import { encode } from '../share/codec';
import type { KV } from './library';

export type CachedSolveStatus = 'solvable' | 'unsolvable' | 'unknown';

export interface CachedSolveInfo {
  status: CachedSolveStatus;
  par: number;
}

const VERSION = 'v2';
const PREFIX = 'squish-builder-solve:' + VERSION + ':';
const INDEX = 'squish-builder-solve-list:' + VERSION;
const MAX_ENTRIES = 200;

export function builderSolveCacheKey(def: LevelDef): string {
  return PREFIX + encode(def);
}

export function getCachedSolve(kv: KV, def: LevelDef): CachedSolveInfo | null {
  try {
    const key = builderSolveCacheKey(def);
    const raw = kv.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw) as CachedSolveInfo;
    if ((item.status === 'solvable' || item.status === 'unsolvable') &&
        Number.isInteger(item.par) && item.par >= 0) {
      touch(kv, key);
      return item;
    }
  } catch {
    /* malformed cache, invalid editor def, or storage failure: solve live */
  }
  return null;
}

export function setCachedSolve(kv: KV, def: LevelDef, info: CachedSolveInfo): void {
  if (info.status === 'unknown') return;
  try {
    const key = builderSolveCacheKey(def);
    kv.setItem(key, JSON.stringify({ status: info.status, par: info.par }));
    touch(kv, key);
    trim(kv);
  } catch {
    /* localStorage can be unavailable/full; the editor still works without cache */
  }
}

export async function solveWithBrowserCache(
  kv: KV,
  def: LevelDef,
  solve: (def: LevelDef) => Promise<CachedSolveInfo>
): Promise<CachedSolveInfo> {
  const hit = getCachedSolve(kv, def);
  if (hit) return hit;
  const out = await solve(def);
  setCachedSolve(kv, def, out);
  return out;
}

function readIndex(kv: KV): string[] {
  try {
    const raw = kv.getItem(INDEX);
    return raw ? (JSON.parse(raw) as string[]).filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(kv: KV, keys: string[]): void {
  kv.setItem(INDEX, JSON.stringify(keys));
}

function touch(kv: KV, key: string): void {
  const keys = readIndex(kv).filter((k) => k !== key);
  keys.push(key);
  writeIndex(kv, keys);
}

function trim(kv: KV): void {
  const keys = readIndex(kv);
  while (keys.length > MAX_ENTRIES) {
    const old = keys.shift();
    if (old) kv.removeItem(old);
  }
  writeIndex(kv, keys);
}
