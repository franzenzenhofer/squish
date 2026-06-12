/* Settings view — the full-screen overlay behind the start screen's Settings
   link. Three preferences (after-win flow, hint button, button labels) plus
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

  const reflect = (): void => {
    const st = getSettings();
    for (const b of seg.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset.v === st.afterWin);
    }
    togHint.classList.toggle('on', st.hintButton);
    togHint.setAttribute('aria-checked', String(st.hintButton));
    togLabels.classList.toggle('on', st.buttonLabels);
    togLabels.setAttribute('aria-checked', String(st.buttonLabels));
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
  togLabels.addEventListener('click', () => {
    d.unlockAudio();
    updateSettings({ buttonLabels: !getSettings().buttonLabels });
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

  const open = (): void => {
    reflect();
    el.classList.add('show');
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
