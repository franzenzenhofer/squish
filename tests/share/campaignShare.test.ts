/* Campaign-level share links — a playable deep link to one curated level
   (`#level-<N>-<key>`). The key is a geometry-only content checksum, so the
   recipient can prove the link names the same level their app already has.
   Critically, the parser must NEVER steal an editor glyph code
   (`#level-<v>-<w>x<h>-<glyphs>.<crc>`) or a compressed `#z-` code. */
import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../../src/engine/types';
import {
  campaignKey, buildCampaignShareHash, buildCampaignShareUrl, parseCampaignShareHash
} from '../../src/share/campaignShare';

const lvl = (): LevelDef => ({ w: 3, h: 3, target: [0, 0], dots: [[2, 2]], par: 1 });

describe('campaignKey', () => {
  it('is geometry-only — par and sol never change it', () => {
    const plain = lvl();
    const stamped: LevelDef = { ...lvl(), par: 99, sol: 'RRDD' };
    expect(campaignKey(stamped)).toBe(campaignKey(plain));
  });
  it('differs when the board differs', () => {
    expect(campaignKey(lvl())).not.toBe(campaignKey({ ...lvl(), dots: [[1, 1]] }));
  });
  it('is url-safe lowercase base36', () => {
    expect(campaignKey(lvl())).toMatch(/^[0-9a-z]+$/);
  });
});

describe('buildCampaignShareHash / buildCampaignShareUrl', () => {
  it('embeds the 1-based level number and the content key', () => {
    const k = campaignKey(lvl());
    expect(buildCampaignShareHash(6, lvl())).toBe('level-7-' + k);
    expect(buildCampaignShareUrl(6, lvl())).toBe('https://squishy.franzai.com/#level-7-' + k);
  });
});

describe('parseCampaignShareHash', () => {
  it('round-trips the level index and key', () => {
    const hash = '#' + buildCampaignShareHash(6, lvl());
    expect(parseCampaignShareHash(hash)).toEqual({ li: 6, key: campaignKey(lvl()) });
  });
  it('accepts the form with or without the leading #', () => {
    expect(parseCampaignShareHash('level-3-abc')).toEqual({ li: 2, key: 'abc' });
  });
  it('returns null for an editor glyph code — never steals it', () => {
    expect(parseCampaignShareHash('#level-1-3x3-M00000002.abc')).toBeNull();
  });
  it('returns null for a compressed z- code', () => {
    expect(parseCampaignShareHash('#z-abc123')).toBeNull();
  });
  it('returns null for unrelated hashes', () => {
    expect(parseCampaignShareHash('#daily')).toBeNull();
    expect(parseCampaignShareHash('')).toBeNull();
  });
});
