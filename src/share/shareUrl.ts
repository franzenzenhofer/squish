/* Share URL builder with a hard self-check, and the matching importer.

   buildShareCode never hands out a broken link: it encodes, decodes, and
   geometry-compares against the source — any mismatch throws (fail loud).
   importShareCode CRC-verifies and decodes (inside decode), then solves the
   level to confirm it is genuinely solvable and to stamp the optimal par. The
   solver is injected so this module stays pure and cycle-free. */

import type { LevelDef, SolveResult } from '../engine/types';
import { encode, decode, geometryEqual, CodecError } from './codec';

export const SHARE_ORIGIN = 'https://squishy.franzai.com';

/** Encode a level to its share code, proving the round-trip before returning. */
export function buildShareCode(def: LevelDef): string {
  const code = encode(def);
  const back = decode(code);
  if (!geometryEqual(back, def)) {
    throw new Error('share self-check failed — refusing to emit a broken link');
  }
  return code;
}

/** Full public https share URL (never an app:// url — Web Share rejects those). */
export function buildShareUrl(def: LevelDef, origin: string = SHARE_ORIGIN): string {
  return origin + '/#' + buildShareCode(def);
}

/** Extract a level code from a location hash, or null. */
export function parseShareHash(hash: string): string | null {
  return hash.startsWith('#level-') ? hash.slice(1) : null;
}

/** CRC-verify + decode (untrusted), then solve to validate and stamp par. */
export function importShareCode(
  code: string,
  solveDef: (def: LevelDef) => SolveResult
): LevelDef {
  const def = decode(code); // throws CodecError on corruption, before solving
  const res = solveDef(def);
  if (res.status !== 'solved') {
    throw new CodecError('shared level is not solvable (' + res.status + ')');
  }
  def.par = res.par;
  return def;
}
