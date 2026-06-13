/* Settings — the player's preferences (SSOT). Persisted under a squish- key so
   "Reset progress" wipes them too (reset resets EVERYTHING). Defaults preserve
   the shipped behavior: win card with the 7s auto-advance, hint button shown,
   contextual button labels. */

export type AfterWin = 'wait' | 'auto' | 'instant';

export interface Settings {
  v: 1;
  /** what happens after a campaign win: wait for a tap on the card, the card
      with the 7s auto-advance countdown, or zoom straight into the next level */
  afterWin: AfterWin;
  /** show the hint bulb in the footer */
  hintButton: boolean;
  /** show the little text labels under the footer buttons (contextual) */
  buttonLabels: boolean;
  /** send anonymous play counters. Default on (matches the shipped web
      behavior); the iOS build surfaces a toggle so the app can opt out. */
  analytics: boolean;
}

const KEY = 'squish-settings-v1';

const DEFAULTS: Settings = {
  v: 1, afterWin: 'auto', hintButton: true, buttonLabels: true, analytics: true
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      if (p.v === 1) {
        return {
          v: 1,
          afterWin: p.afterWin === 'wait' || p.afterWin === 'instant' ? p.afterWin : 'auto',
          hintButton: p.hintButton !== false,
          buttonLabels: p.buttonLabels !== false,
          analytics: p.analytics !== false
        };
      }
    }
  } catch {
    /* unreadable — fall through to defaults */
  }
  return { ...DEFAULTS };
}

let current: Settings = load();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Omit<Settings, 'v'>>): Settings {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage full or blocked — the choice still holds for this session */
  }
  return current;
}
