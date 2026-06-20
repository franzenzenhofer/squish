/* Campaign-level share links — a playable deep link to ONE curated campaign
   level: `#level-<N>-<key>`, where N is the 1-based level number and <key> is a
   geometry-only content checksum of that level.

   Why a separate, tiny scheme (not the editor `#z-`/`#level-<glyphs>.<crc>`
   share): a campaign level already ships inside every copy of the app, so the
   link need not carry the board at all - just name the level and prove (via the
   key) that the recipient's local copy is the same one the sender solved. The
   recipient plays it out of order; their real progress is untouched.

   The grammar is deliberately disjoint from the editor codes so the importer is
   never confused (see parseCampaignShareHash): the editor form always contains a
   `<w>x<h>` token and a `.crc` suffix, neither of which can appear here. */

import type { LevelDef } from '../engine/types';
import { encode } from './codec';
import { crc32Base36 } from './crc32';
import { SHARE_ORIGIN } from './shareUrl';

/** `#level-<digits>-<base36key>` and nothing else — no `<w>x<h>`, no `.crc`. */
const CAMPAIGN_HASH_RE = /^#?level-(\d+)-([0-9a-z]+)$/;

/** A stable, geometry-only key for a campaign level. encode() ignores par/sol,
    so a stamped def and a fresh one yield the same key. */
export function campaignKey(def: LevelDef): string {
  return crc32Base36(encode(def));
}

/** The deep-link hash (no leading #) for sharing campaign level `li` (0-based). */
export function buildCampaignShareHash(li: number, def: LevelDef): string {
  return 'level-' + (li + 1) + '-' + campaignKey(def);
}

/** The full public https deep link for a campaign-level share. */
export function buildCampaignShareUrl(
  li: number, def: LevelDef, origin: string = SHARE_ORIGIN
): string {
  return origin + '/#' + buildCampaignShareHash(li, def);
}

export interface CampaignShareRef {
  /** 0-based campaign level index. */
  li: number;
  /** the content key to verify against the local level. */
  key: string;
}

/** Parse a campaign-share hash. Returns null for anything that is not exactly
    this form — including editor glyph codes and compressed `z-` codes — so the
    editor importer keeps owning those. */
export function parseCampaignShareHash(hash: string): CampaignShareRef | null {
  const m = CAMPAIGN_HASH_RE.exec(hash);
  if (!m) return null;
  return { li: Number(m[1]) - 1, key: m[2] as string };
}
