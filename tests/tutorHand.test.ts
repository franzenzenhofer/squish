/* Tutor-hand decisions as pure functions — the idle nudge on the tutorial
   levels. These guard the contract: only the campaign, only the labelled
   tutorial (li 0-2, where the coach does not yet run), only on a settled board
   nothing else owns, only after a real quiet beat, and never more than
   HAND_MAX times per attempt. */
import { describe, expect, it } from 'vitest';
import {
  HAND_IDLE_MS,
  HAND_LAST_LI,
  HAND_MAX,
  HAND_REPEAT_MS,
  shouldShowHand,
  type HandInputs
} from '../src/game/tutorHand';
import { NUDGE_FROM_LI } from '../src/game/coach';

/** A baseline that WOULD show a hand — each test perturbs one field. */
function base(over: Partial<HandInputs> = {}): HandInputs {
  return {
    li: 0, playKind: 'campaign', idleMs: HAND_IDLE_MS, shown: 0,
    boardIdle: true, blocked: false,
    ...over
  };
}

describe('shouldShowHand', () => {
  it('shows the first hand once the quiet beat has passed', () => {
    expect(shouldShowHand(base())).toBe(true);
  });

  it('stays quiet before the beat', () => {
    expect(shouldShowHand(base({ idleMs: HAND_IDLE_MS - 1 }))).toBe(false);
  });

  it('waits the longer repeat gap for every hand after the first', () => {
    expect(shouldShowHand(base({ shown: 1, idleMs: HAND_IDLE_MS }))).toBe(false);
    expect(shouldShowHand(base({ shown: 1, idleMs: HAND_REPEAT_MS }))).toBe(true);
  });

  it('stops after HAND_MAX hands on one attempt', () => {
    expect(shouldShowHand(base({ shown: HAND_MAX - 1, idleMs: HAND_REPEAT_MS }))).toBe(true);
    expect(shouldShowHand(base({ shown: HAND_MAX, idleMs: HAND_REPEAT_MS }))).toBe(false);
  });

  it('covers every labelled tutorial level and nothing past it', () => {
    for (let li = 0; li <= HAND_LAST_LI; li++) {
      expect(shouldShowHand(base({ li }))).toBe(true);
    }
    expect(shouldShowHand(base({ li: HAND_LAST_LI + 1 }))).toBe(false);
  });

  it('hands off to the coach with no gap and no overlap', () => {
    expect(HAND_LAST_LI + 1).toBe(NUDGE_FROM_LI);
  });

  it('never tutors a daily, a debug play or the level editor', () => {
    for (const playKind of ['daily', 'debug', 'custom']) {
      expect(shouldShowHand(base({ playKind }))).toBe(false);
    }
  });

  it('never points while the board is busy', () => {
    expect(shouldShowHand(base({ boardIdle: false }))).toBe(false);
  });

  it('never points while something else owns the screen or already points', () => {
    expect(shouldShowHand(base({ blocked: true }))).toBe(false);
  });
});
