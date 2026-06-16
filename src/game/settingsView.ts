/* Settings view — the full-screen overlay behind the start screen's Settings
   link. Preferences (after-win flow, hint button, button labels, Zen mode) plus
   the Reset-progress action (two-tap arm, moved here from the start screen). */
import { resetProgress } from './persist';
import { getSettings, updateSettings, type AfterWin } from './settings';

export interface SettingsViewDeps {
  /** re-apply settings to the live UI (footer classes, labels) */
  onChange: () => void;
  unlockAudio: () => void;
}

export interface SettingsView {
  open: () => void;
  close: () => void;
}

export function createSettingsView(d: SettingsViewDeps): SettingsView {
  const el = document.getElementById('settings') as HTMLElement;
  const seg = document.getElementById('segAfterWin') as HTMLElement;
  const togHint = document.getElementById('togHint') as HTMLButtonElement;
  const togLabels = document.getElementById('togLabels') as HTMLButtonElement;
  const togZen = document.getElementById('togZen') as HTMLButtonElement;
  const togAnalytics = document.getElementById('togAnalytics') as HTMLButtonElement;
  const rowAnalytics = document.getElementById('setrowAnalytics') as HTMLElement;
  /* the opt-out toggle is surfaced only in the iOS build; the hosted web keeps
     anonymous counts always-on (as shipped, covered by the privacy card). The
     privacy card itself swaps its host/delivery wording per target so it stays
     legally accurate: web is served from Cloudflare, iOS runs fully offline. */
  const isIos = import.meta.env.VITE_PLATFORM === 'ios';
  if (isIos) rowAnalytics.hidden = false;
  for (const el of document.querySelectorAll<HTMLElement>('[data-plat]')) {
    el.hidden = isIos ? el.dataset.plat !== 'ios' : el.dataset.plat !== 'web';
  }

  const reflect = (): void => {
    const st = getSettings();
    for (const b of seg.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.v === st.afterWin);
    }
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
  breset.addEventListener('click', () => {
    d.unlockAudio();
    if (!armed) {
      armed = true;
      breset.textContent = 'Tap again to reset everything';
      armTimer = window.setTimeout(() => {
        armed = false;
        breset.textContent = 'Reset progress';
      }, 3000);
      return;
    }
    clearTimeout(armTimer);
    resetProgress();
    location.reload();
  });

  /* the privacy & data statement — a closeable card over the settings */
  const elPrivacy = document.getElementById('privacy') as HTMLElement;
  document.getElementById('bprivacy')?.addEventListener('click', () => {
    d.unlockAudio();
    elPrivacy.classList.add('show');
    elPrivacy.scrollTop = 0;
  });
  document.getElementById('bpback')?.addEventListener('click', () => {
    d.unlockAudio();
    elPrivacy.classList.remove('show');
  });

  const open = (): void => {
    reflect();
    el.classList.add('show');
    el.scrollTop = 0;
  };
  const close = (): void => {
    el.classList.remove('show');
  };
  document.getElementById('bsback')?.addEventListener('click', () => {
    d.unlockAudio();
    close();
  });

  return { open, close };
}
