/* "Your Creations" — local-only library of player-made levels. Stored under the
   squish-custom prefix (so the existing resetProgress() sweep covers it). A
   single ordered id list is the SSOT for ordering; each level lives in its own
   key. A dangling id (item removed out of band) is silently filtered, never a
   crash. The KV store is injectable so the logic is pure and unit-testable. */

import type { LevelDef } from '../engine/types';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Creation {
  id: string;
  name: string;
  def: LevelDef;
  createdAt: number;
}

export interface CreationMeta {
  id: string;
  name: string;
  w: number;
  h: number;
  par: number;
}

const LIST = 'squish-custom-list';
const ITEM = 'squish-custom:';
/* "Shared with you" — levels opened from a share link. Same shape as a creation
   plus the share `code`, so the SAME link is never re-added (no self-spam). */
const SLIST = 'squish-shared-list';
const SITEM = 'squish-shared:';

function readList(kv: KV, listKey = LIST): string[] {
  try {
    const raw = kv.getItem(listKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeList(kv: KV, ids: string[], listKey = LIST): void {
  kv.setItem(listKey, JSON.stringify(ids));
}

function nextId(ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    const n = Number(id.replace(/^c/, ''));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return 'c' + (max + 1);
}

export function getCreation(kv: KV, id: string): Creation | null {
  try {
    const raw = kv.getItem(ITEM + id);
    return raw ? (JSON.parse(raw) as Creation) : null;
  } catch {
    return null;
  }
}

export function saveCreation(kv: KV, def: LevelDef, name: string, now = Date.now()): string {
  const ids = readList(kv);
  const id = nextId(ids);
  const creation: Creation = { id, name, def, createdAt: now };
  kv.setItem(ITEM + id, JSON.stringify(creation));
  writeList(kv, [...ids, id]);
  return id;
}

export function updateCreation(kv: KV, id: string, def: LevelDef): void {
  const cur = getCreation(kv, id);
  if (!cur) return;
  kv.setItem(ITEM + id, JSON.stringify({ ...cur, def }));
}

export function deleteCreation(kv: KV, id: string): void {
  kv.removeItem(ITEM + id);
  writeList(kv, readList(kv).filter((x) => x !== id));
}

export function listCreations(kv: KV): CreationMeta[] {
  const out: CreationMeta[] = [];
  for (const id of readList(kv)) {
    const c = getCreation(kv, id);
    if (!c) continue; // dangling id — skip
    out.push({ id: c.id, name: c.name, w: c.def.w, h: c.def.h, par: c.def.par });
  }
  return out;
}

/* ---- "Shared with you" shelf (squish-shared:*) — its own ordered id list ---- */

export interface SharedCreation extends Creation { code: string; }

export function getShared(kv: KV, id: string): SharedCreation | null {
  try {
    const raw = kv.getItem(SITEM + id);
    return raw ? (JSON.parse(raw) as SharedCreation) : null;
  } catch {
    return null;
  }
}

export function listShared(kv: KV): CreationMeta[] {
  const out: CreationMeta[] = [];
  for (const id of readList(kv, SLIST)) {
    const c = getShared(kv, id);
    if (!c) continue;
    out.push({ id: c.id, name: c.name, w: c.def.w, h: c.def.h, par: c.def.par });
  }
  return out;
}

/** True if this exact share `code` is already in the Shared-with-you shelf. */
export function hasSharedCode(kv: KV, code: string): boolean {
  return readList(kv, SLIST).some((id) => getShared(kv, id)?.code === code);
}

/** Add a received level to Shared-with-you, IDEMPOTENT on the share `code` so a
    repeated link (e.g. sharing with yourself) never re-populates the list. */
export function saveShared(kv: KV, def: LevelDef, code: string, name: string, now = Date.now()): string {
  const existing = readList(kv, SLIST).find((id) => getShared(kv, id)?.code === code);
  if (existing) return existing; // same link already saved — no duplicate
  const ids = readList(kv, SLIST);
  const id = nextId(ids);
  const item: SharedCreation = { id, name, def, createdAt: now, code };
  kv.setItem(SITEM + id, JSON.stringify(item));
  writeList(kv, [...ids, id], SLIST);
  return id;
}

export function deleteShared(kv: KV, id: string): void {
  kv.removeItem(SITEM + id);
  writeList(kv, readList(kv, SLIST).filter((x) => x !== id), SLIST);
}
