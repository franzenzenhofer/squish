/* Tutor hand — on the labelled tutorial levels only, if the player just sits
   there doing nothing, show the winning swipe as a fading arrow.

   Why: 39.5% of everyone who has ever opened the game never cleared level 01 -
   a ONE-swipe board that every single winner solves in exactly 1 move (avg
   moves 1.00 vs par 1). The median first visit lasts 24 seconds. So the losses
   there are not difficulty, and the opening screen must never sit silent.

   It reuses the hint ARROW, never hint MODE: no hearts are lost, no `hint`
   event is written, `hintUsed` stays false. All it does is point.

   Hand-off: the hand owns li 0-2 (the labelled tutorial), the coach's over-par
   nudge starts at li 3 (coach.NUDGE_FROM_LI) - they never overlap. */

/** Last campaign level index the hand appears on: li 2 = "03", the last
    labelled tutorial level. From li 3 on, the coach takes over. */
export const HAND_LAST_LI = 2;
/** Quiet beat before the first hand — long enough to never rush a thinker. */
export const HAND_IDLE_MS = 5000;
/** Gap between repeats while the player still has not moved. */
export const HAND_REPEAT_MS = 7000;
/** Never more than this many hands per level attempt. */
export const HAND_MAX = 3;

export interface HandInputs {
  /** campaign level index (0-based) */
  li: number;
  /** play tag kind — only 'campaign' is tutored */
  playKind: string;
  /** ms since the last player input (or since the level was applied) */
  idleMs: number;
  /** hands already shown on this level attempt */
  shown: number;
  /** the board is settled and interactive (mode 'idle') */
  boardIdle: boolean;
  /** something else owns the screen or is already pointing: intro card, menu,
      hint mode, or an arrow still on screen */
  blocked: boolean;
}

/** Pure decision: should a tutor hand be shown right now? */
export function shouldShowHand(i: HandInputs): boolean {
  if (i.playKind !== 'campaign') return false;
  if (i.li > HAND_LAST_LI) return false;
  if (!i.boardIdle || i.blocked) return false;
  if (i.shown >= HAND_MAX) return false;
  return i.idleMs >= (i.shown === 0 ? HAND_IDLE_MS : HAND_REPEAT_MS);
}
