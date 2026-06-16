/* Coach — gentle, capped nudges toward the Hint bulb when a player overshoots a
   level's optimal move count (par). Pure decisions (DOM-free, unit-tested) plus
   the persisted lifetime nudge counter. "Never nag": tutorials (li < 4) are
   untouched, dailies stay help-free, the bulb is never nudged when hidden or
   already on, and the bubble shows at most three times ever, on an escalating
   threshold.

   We NEVER auto-enable hint mode and NEVER change the Hint bulb's visibility —
   the bulb stays owned by hud()'s `nohint` class (hint setting off OR daily).
   `hintHidden` here is read-only, used only to decide whether a nudge makes
   sense. All the coach ever does is suggest; the player chooses. */

/** Campaign level index (0-based) the coach starts at — level 4 as shown to the
    player (1-3 are the labelled tutorial). */
export const NUDGE_FROM_LI = 3;
/** The "over par" multiplier for each successive nudge: the moment they pass par
    (1x), then badly stuck (3x), then way over — "400% more" (5x). One entry per
    lifetime showing; after the last the bubble never shows again. */
export const NUDGE_MULTS: readonly number[] = [1, 3, 5];
/** Lifetime cap: after this many nudges the bubble never shows again. */
export const NUDGE_MAX = NUDGE_MULTS.length;

const NUDGE_KEY = 'squish-hintnudge-v1';

/** Just the slice of localStorage the counter needs — lets tests inject a shim. */
export interface CoachStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CoachInputs {
  /** campaign level index (0-based) */
  li: number;
  moves: number;
  par: number;
  /** play tag kind — only 'campaign' is coached */
  playKind: string;
  /** the bulb is hidden (hint setting off OR daily) — no point coaching */
  hintHidden: boolean;
  /** the player is already peeking at a hint */
  hintMode: boolean;
  /** how many times the nudge bubble has shown, ever (persisted) */
  nudgeSeen: number;
}

/** Should the "Hints are friends too" bubble + bulb pulse fire now? Only in the
    campaign, past the tutorial (li >= 3), with a real par and a visible bulb the
    player is not already using. The threshold escalates per lifetime showing
    (1x -> 3x -> 5x par) and after NUDGE_MAX showings it never fires again. We
    only ever suggest — hint mode is never auto-enabled. */
export function shouldNudgeHint(i: CoachInputs): boolean {
  if (i.playKind !== 'campaign') return false;
  if (i.li < NUDGE_FROM_LI) return false;
  if (i.par <= 0) return false;
  if (i.hintHidden || i.hintMode) return false;
  if (i.nudgeSeen >= NUDGE_MAX) return false;
  const mult = NUDGE_MULTS[i.nudgeSeen] ?? NUDGE_MULTS[NUDGE_MAX - 1] ?? 1;
  return i.moves > i.par * mult;
}

/** Lifetime count of nudge-bubble showings. Persisted under a squish- key so
    resetProgress() wipes it. A corrupt/missing value reads as zero. */
export function getNudgeSeen(store: CoachStore = localStorage): number {
  try {
    const raw = store.getItem(NUDGE_KEY);
    if (raw) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* unreadable — treat as never nudged */
  }
  return 0;
}

/** Record one more nudge showing. */
export function bumpNudgeSeen(store: CoachStore = localStorage): void {
  try {
    store.setItem(NUDGE_KEY, String(getNudgeSeen(store) + 1));
  } catch {
    /* storage blocked — the cap still holds for this session via the caller */
  }
}
