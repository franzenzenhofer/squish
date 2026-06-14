/* Client loader for the precomputed daily manifest
   (scripts/build-daily-manifest.ts). Lets getDaily resolve a daily puzzle
   instantly from a shipped, pre-solved level instead of paying the (slow)
   in-worker generation + solve.

   The manifest is a content-hashed chunk imported on demand, so it is always
   in lock-step with the bundled generator and never stale. Best-effort: any
   failure (missing date, parse error, offline web cold-load) falls back to
   live generation, which is the same deterministic source - so the board is
   identical either way. */
import type { LevelDef } from '../engine/types';

interface DailyManifest {
  v: number;
  fp: string;
  days: Record<string, LevelDef>;
}

let cache: Promise<Record<string, LevelDef>> | null = null;

async function fetchManifest(): Promise<Record<string, LevelDef>> {
  const mod = (await import('../daily-verified.json')) as unknown as { default: DailyManifest };
  const m = mod.default;
  return m && m.days && typeof m.days === 'object' ? m.days : {};
}

/** All precomputed dailies keyed by YYYY-MM-DD (empty object on any failure). */
export function loadDailyManifest(): Promise<Record<string, LevelDef>> {
  if (!cache) cache = fetchManifest().catch(() => ({}));
  return cache;
}

/** The shipped, pre-solved daily for a date, or null if not in the manifest. */
export async function precomputedDaily(date: string): Promise<LevelDef | null> {
  const days = await loadDailyManifest();
  const def = days[date];
  return def ? { ...def } : null;
}
