/* Coach decisions as pure functions — the over-par hint nudge (escalating +
   lifetime-capped). These guard the "never nag" contract: tutorials are
   untouched, dailies stay help-free, a player who is already peeking is never
   nudged, and hint mode is NEVER auto-enabled (the coach only suggests). Plus
   the persisted lifetime nudge counter. */
import { describe, expect, it } from 'vitest';
import {
  bumpNudgeSeen,
  getNudgeSeen,
  shouldNudgeHint,
  type CoachInputs
} from '../src/game/coach';
import * as coachModule from '../src/game/coach';

/** A baseline that WOULD nudge — each test perturbs one field. */
function base(over: Partial<CoachInputs> = {}): CoachInputs {
  return {
    li: 3, moves: 11, par: 5, playKind: 'campaign',
    hintHidden: false, hintMode: false, nudgeSeen: 0,
    ...over
  };
}

function fakeStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('shouldNudgeHint', () => {
  it('nudges the first time as soon as the player passes par (level 4+)', () => {
    expect(shouldNudgeHint(base({ moves: 6, par: 5, nudgeSeen: 0 }))).toBe(true);
  });
  it('does not nudge at or under par', () => {
    expect(shouldNudgeHint(base({ moves: 5, par: 5 }))).toBe(false);
    expect(shouldNudgeHint(base({ moves: 4, par: 5 }))).toBe(false);
  });
  it('holds the nudge until the tutorial is over (li < 3)', () => {
    expect(shouldNudgeHint(base({ li: 0 }))).toBe(false);
    expect(shouldNudgeHint(base({ li: 2 }))).toBe(false);
    expect(shouldNudgeHint(base({ li: 3 }))).toBe(true);
  });
  it('only nudges in the campaign — never daily or other modes', () => {
    expect(shouldNudgeHint(base({ playKind: 'daily' }))).toBe(false);
    expect(shouldNudgeHint(base({ playKind: 'debug' }))).toBe(false);
    expect(shouldNudgeHint(base({ playKind: 'custom' }))).toBe(false);
  });
  it('never nudges when the bulb is hidden (hint off / daily)', () => {
    expect(shouldNudgeHint(base({ hintHidden: true }))).toBe(false);
  });
  it('never nudges when hint mode is already on', () => {
    expect(shouldNudgeHint(base({ hintMode: true }))).toBe(false);
  });
  it('guards a degenerate par of 0', () => {
    expect(shouldNudgeHint(base({ moves: 3, par: 0 }))).toBe(false);
  });

  it('escalates: the second nudge waits for 3x par, the third for 5x par', () => {
    // seen 1: par 5 -> threshold 3x = 15; one-over-par is no longer enough
    expect(shouldNudgeHint(base({ moves: 6, par: 5, nudgeSeen: 1 }))).toBe(false);
    expect(shouldNudgeHint(base({ moves: 15, par: 5, nudgeSeen: 1 }))).toBe(false);
    expect(shouldNudgeHint(base({ moves: 16, par: 5, nudgeSeen: 1 }))).toBe(true);
    // seen 2: par 5 -> threshold 5x = 25
    expect(shouldNudgeHint(base({ moves: 16, par: 5, nudgeSeen: 2 }))).toBe(false);
    expect(shouldNudgeHint(base({ moves: 25, par: 5, nudgeSeen: 2 }))).toBe(false);
    expect(shouldNudgeHint(base({ moves: 26, par: 5, nudgeSeen: 2 }))).toBe(true);
  });
  it('stops forever after three lifetime showings', () => {
    expect(shouldNudgeHint(base({ moves: 100, par: 5, nudgeSeen: 3 }))).toBe(false);
    expect(shouldNudgeHint(base({ moves: 100, par: 5, nudgeSeen: 9 }))).toBe(false);
  });
  it('never auto-enables — the coach only suggests (no auto-hint export)', () => {
    // shouldAutoHint was removed on purpose; assert the module no longer ships it
    // so a future re-introduction is a conscious choice, not an accident.
    expect((coachModule as Record<string, unknown>).shouldAutoHint).toBeUndefined();
  });
});

describe('nudge lifetime counter', () => {
  it('starts at zero and increments, persisting across reads', () => {
    const s = fakeStore();
    expect(getNudgeSeen(s)).toBe(0);
    bumpNudgeSeen(s);
    expect(getNudgeSeen(s)).toBe(1);
    bumpNudgeSeen(s);
    expect(getNudgeSeen(s)).toBe(2);
  });
  it('tolerates a corrupt stored value as zero', () => {
    const s = fakeStore();
    s.setItem('squish-hintnudge-v1', 'garbage');
    expect(getNudgeSeen(s)).toBe(0);
  });
});
