/* Share URL builder with a hard self-check, and the matching importer.

   buildShareCode never hands out a broken link: it encodes, decodes, and
   geometry-compares against the source — any mismatch throws (fail loud).
   importShareCode CRC-verifies and decodes (inside decode), then solves the
   level to confirm it is genuinely solvable and to stamp the optimal par. The
   solver is injected so this module stays pure and cycle-free. */

import type { LevelDef, SolveResult } from '../engine/types';
import { encode, decode, encodeBytes, decodeBytes, geometryEqual, CodecError } from './codec';
import { compress, decompress } from './compress';

export const SHARE_ORIGIN = 'https://squishy.franzai.com';

/** Encode a level to its readable glyph code, proving the round-trip first. */
export function buildShareCode(def: LevelDef): string {
  const code = encode(def);
  if (!geometryEqual(decode(code), def)) {
    throw new Error('share self-check failed — refusing to emit a broken link');
  }
  return code;
}

/** The compact, zip-compressed payload (z-...), self-checked before returning. */
export function buildSharePayload(def: LevelDef): string {
  const z = 'z-' + compress(encodeBytes(def));
  if (!geometryEqual(decodeBytes(decompress(z.slice(2))), def)) {
    throw new Error('share self-check failed — refusing to emit a broken link');
  }
  return z;
}

/** Full public https share URL (compressed; never an app:// url). */
export function buildShareUrl(def: LevelDef, origin: string = SHARE_ORIGIN): string {
  return origin + '/#' + buildSharePayload(def);
}

/** Extract a share payload (z-... compressed, or level-... readable) from a hash. */
export function parseShareHash(hash: string): string | null {
  if (hash.startsWith('#z-')) return hash.slice(1);
  if (hash.startsWith('#level-')) return hash.slice(1);
  return null;
}

/** Decode an untrusted payload (both forms), then solve to validate + stamp par. */
export function importShareCode(
  payload: string,
  solveDef: (def: LevelDef) => SolveResult
): LevelDef {
  const def = payload.startsWith('z-')
    ? decodeBytes(decompress(payload.slice(2)))
    : decode(payload); // throws CodecError on corruption, before solving
  const res = solveDef(def);
  if (res.status !== 'solved') {
    throw new CodecError('shared level is not solvable (' + res.status + ')');
  }
  def.par = res.par;
  return def;
}
