/* Client loader for the precomputed levels manifest
   (scripts/build-levels-manifest.ts). Lets getLevel resolve an endless level
   (51..200) instantly from a shipped, pre-solved board instead of paying the
   (slow, on a phone sometimes catastrophic) in-worker generation + solve.

   Mirrors dailyManifest.ts: a content-hashed chunk imported on demand, always
   in lock-step with the bundled generator (guarded by tests/levels-manifest
   .test.ts), best-effort - any failure falls back to live generation, which is
   the same deterministic source, so the board is identical either way. */
import type { LevelDef } from '../engine/types';

interface LevelsManifest {
  v: number;
  fp: string;
  levels: Record<string, LevelDef>;
}

let cache: Promise<Record<number, LevelDef>> | null = null;

async function fetchManifest(): Promise<Record<number, LevelDef>> {
  const mod = (await import('../levels-verified.json')) as unknown as { default: LevelsManifest };
  const m = mod.default;
  if (!m || !m.levels || typeof m.levels !== 'object') return {};
  const out: Record<number, LevelDef> = {};
  for (const [k, def] of Object.entries(m.levels)) out[Number(k)] = def;
  return out;
}

/** All precomputed endless levels keyed by level number n (empty on any failure). */
export function loadLevelsManifest(): Promise<Record<number, LevelDef>> {
  if (!cache) cache = fetchManifest().catch(() => ({}));
  return cache;
}

/** The shipped, pre-solved level for number n, or null if not in the manifest. */
export async function precomputedLevel(n: number): Promise<LevelDef | null> {
  const levels = await loadLevelsManifest();
  const def = levels[n];
  return def ? { ...def } : null;
}
