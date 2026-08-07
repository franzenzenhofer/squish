/* Flow decisions — pure, DOM-free choices the orchestrator wires into chrome
   and boot. Kept here so they are unit-testable in isolation. */
import type { PlayTag } from './session';
import { parseCampaignShareHash } from '../share/campaignShare';

/** The hint bulb is hidden when the player turned it off, OR whenever a daily
    is in play — the daily is the hard one, solved without help, no bulb. */
export function hintHidden(hintButton: boolean, play: PlayTag): boolean {
  return !hintButton || play.kind === 'daily';
}

export interface BootPlan {
  /** show the start menu over the board? A brand-new visitor goes straight to
      the board instead: measured 2026-08-07, ~33% of visitors left from the
      title screen without ever tapping Play, while 86% of the players who did
      reach a board cleared level 01. The menu stays one tap away on the logo,
      and it still greets everyone who has progress worth continuing. */
  menu: boolean;
  /** a `#daily` deep-link starts today's daily directly, no menu. */
  daily: boolean;
  /** the campaign level index to resume, fresh (daily is never a resume target). */
  li: number;
  /** `#builder` opens the level editor straight away. */
  builder?: boolean;
  /** a `#level-<code>` editor/custom deep-link carries a whole shared level. */
  shared?: string;
  /** a `#level-<n>-<key>` deep-link names a curated campaign level to play. */
  campaignShare?: { li: number; key: string };
}

/** Decide what boot should do. `#builder` opens the editor; a `#level-<n>-<key>`
    link replays a curated campaign level; a `#z-`/`#level-<glyphs>.<crc>` link
    carries a whole shared level; `#daily` opens today's daily; every other entry
    resumes the saved campaign level.

    Order matters: the campaign-share form is checked BEFORE the editor form so a
    short `#level-7-abc` link is never handed to the glyph importer. */
export function bootPlan(savedLi: number, hash: string, hasProgress = true): BootPlan {
  const menu = false;
  if (hash === '#builder') return { menu, daily: false, li: savedLi, builder: true };
  const campaign = parseCampaignShareHash(hash);
  if (campaign) return { menu, daily: false, li: savedLi, campaignShare: campaign };
  if (hash.startsWith('#z-') || hash.startsWith('#level-')) {
    return { menu, daily: false, li: savedLi, shared: hash.slice(1) };
  }
  if (hash === '#daily') return { menu, daily: true, li: savedLi };
  /* the plain entry: the menu greets a returning player, a first-timer gets the
     board itself — nothing to continue, so there is nothing to choose */
  return { menu: hasProgress, daily: false, li: savedLi };
}

/** The campaign level index to resume after ANY win. A campaign win steps
    forward one; a daily, debug or custom/shared win never alters campaign
    progress, so the player drops back into their OWN next open level. A win
    never lands on the level overview - this is the single source of that rule. */
export function winResumeLi(play: PlayTag, li: number): number {
  return play.kind === 'campaign' ? li + 1 : li;
}
