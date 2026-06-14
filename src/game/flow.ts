/* Flow decisions — pure, DOM-free choices the orchestrator wires into chrome
   and boot. Kept here so they are unit-testable in isolation. */
import type { PlayTag } from './session';

/** The hint bulb is hidden when the player turned it off, OR whenever a daily
    is in play — the daily is the hard one, solved without help, no bulb. */
export function hintHidden(hintButton: boolean, play: PlayTag): boolean {
  return !hintButton || play.kind === 'daily';
}

export interface BootPlan {
  /** a `#daily` deep-link starts today's daily directly, no menu. */
  daily: boolean;
  /** the campaign level index to resume, fresh (daily is never a resume target). */
  li: number;
  /** `#builder` opens the level editor straight away. */
  builder?: boolean;
  /** a `#level-<code>` deep-link carries a shared custom level to play. */
  shared?: string;
}

/** Decide what boot should do. `#builder` opens the editor; a `#level-<code>`
    link carries a shared level; `#daily` opens today's daily; every other entry
    resumes the saved campaign level. */
export function bootPlan(savedLi: number, hash: string): BootPlan {
  if (hash === '#builder') return { daily: false, li: savedLi, builder: true };
  if (hash.startsWith('#level-')) return { daily: false, li: savedLi, shared: hash.slice(1) };
  return { daily: hash === '#daily', li: savedLi };
}
