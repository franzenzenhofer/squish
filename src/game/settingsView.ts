/* Settings view — the full-screen overlay behind the start screen's Settings
   link. Preferences (after-win flow, hint button, button labels, Zen mode) plus
   the Reset-progress action (two-tap arm, moved here from the start screen). */
import { resetProgress } from './persist';
import { getSettings, updateSettings, type AfterWin } from './settings';

export interface SettingsViewDeps {
  /** re-apply settings to the live UI (footer classes, labels) */
  onChange: () => void;
  unlockAudio: () => void;
  /** the back (X) button steps back one history entry */
  onBack: () => void;
  /** open / close the nested Privacy card as history steps */
  onOpenPrivacy: () => void;
  onClosePrivacy: () => void;
}

export interface SettingsView {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  /** the nested Privacy card - opened/closed by the nav controller */
  openPrivacy: () => void;
  closePrivacy: () => void;
}

export function createSettingsView(d: SettingsViewDeps): SettingsView {
  const el = document.getElementById('settings') as HTMLElement;
  const seg = document.getElementById('segAfterWin') as HTMLElement;
  const afterWinExpl = document.getElementById('afterWinExpl') as HTMLElement;
  /* one short line per option, matching the real win flow in endings.ts:
     'wait' keeps the card up until a tap, 'auto' shows the card then advances
     on its own after a few seconds, 'instant' skips the card entirely. */
  const AFTER_WIN_EXPL: Record<AfterWin, string> = {
    wait: 'The win card waits for your tap.',
    auto: 'The win card auto-advances after a moment.',
    instant: 'Skip the card - straight to the next level.'
  };
  const togHint = document.getElementById('togHint') as HTMLButtonElement;
  const togLabels = document.getElementById('togLabels') as HTMLButtonElement;
  const togZen = document.getElementById('togZen') as HTMLButtonElement;
  const togAnalytics = document.getElementById('togAnalytics') as HTMLButtonElement;
  /* The iOS-only opt-out row (data-plat="ios") and the web/iOS privacy wording
     are gated by applyPlatformChrome (platform.ts), applied once at boot - the
     hosted web keeps anonymous counts always-on (covered by the privacy card),
     while the iOS build surfaces the opt-out toggle. */

  const reflect = (): void => {
    const st = getSettings();
    for (const b of seg.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.v === st.afterWin);
    }
    afterWinExpl.textContent = AFTER_WIN_EXPL[st.afterWin];
    togHint.classList.toggle('on', st.hintButton);
    togHint.setAttribute('aria-checked', String(st.hintButton));
    togLabels.classList.toggle('on', st.buttonLabels);
    togLabels.setAttribute('aria-checked', String(st.buttonLabels));
    togZen.classList.toggle('on', st.zenMode);
    togZen.setAttribute('aria-checked', String(st.zenMode));
    togAnalytics.classList.toggle('on', st.analytics);
    togAnalytics.setAttribute('aria-checked', String(st.analytics));
  };

  seg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b?.dataset.v) return;
    d.unlockAudio();
    updateSettings({ afterWin: b.dataset.v as AfterWin });
    reflect();
    d.onChange();
  });
  togHint.addEventListener('click', () => {
    d.unlockAudio();
    updateSettings({ hintButton: !getSettings().hintButton });
    reflect();
    d.onChange();
  });
  togAnalytics.addEventListener('click', () => {
    d.unlockAudio();
    updateSettings({ analytics: !getSettings().analytics });
    reflect();
  });
  togLabels.addEventListener('click', () => {
    d.unlockAudio();
    updateSettings({ buttonLabels: !getSettings().buttonLabels });
    reflect();
    d.onChange();
  });
  togZen.addEventListener('click', () => {
    d.unlockAudio();
    updateSettings({ zenMode: !getSettings().zenMode });
    reflect();
    d.onChange();
  });

  /* Reset progress — one tap arms, a second within 3s wipes and reloads */
  const breset = document.getElementById('breset') as HTMLButtonElement;
  let armed = false;
  let armTimer = 0;
  const disarmReset = (): void => {
    if (armTimer) clearTimeout(armTimer);
    armTimer = 0;
    armed = false;
    breset.textContent = 'Reset progress';
  };
  breset.addEventListener('click', () => {
    d.unlockAudio();
    if (!armed) {
      armed = true;
      breset.textContent = 'Tap again to reset everything';
      armTimer = window.setTimeout(() => {
        disarmReset();
      }, 3000);
      return;
    }
    disarmReset();
    resetProgress();
    location.reload();
  });

  /* the privacy & data statement — a closeable card over the settings. The nav
     controller drives its open/close as history entries (DOM toggles below). */
  const elPrivacy = document.getElementById('privacy') as HTMLElement;
  const openPrivacy = (): void => { elPrivacy.classList.add('show'); elPrivacy.scrollTop = 0; };
  const closePrivacy = (): void => { elPrivacy.classList.remove('show'); };
  document.getElementById('bprivacy')?.addEventListener('click', () => {
    d.unlockAudio();
    d.onOpenPrivacy();
  });
  document.getElementById('bpback')?.addEventListener('click', () => {
    d.unlockAudio();
    d.onClosePrivacy();
  });

  const open = (): void => {
    reflect();
    el.classList.add('show');
    el.scrollTop = 0;
  };
  const close = (): void => {
    el.classList.remove('show');
    closePrivacy();
    disarmReset();
  };
  document.getElementById('bsback')?.addEventListener('click', () => {
    d.unlockAudio();
    d.onBack();
  });

  return { open, close, isOpen: () => el.classList.contains('show'), openPrivacy, closePrivacy };
}
