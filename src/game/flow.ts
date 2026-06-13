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
}

/** Decide what boot should do. A `#daily` hash (the daily share link) opens the
    daily; every other entry resumes the saved campaign level. */
export function bootPlan(savedLi: number, hash: string): BootPlan {
  return { daily: hash === '#daily', li: savedLi };
}
