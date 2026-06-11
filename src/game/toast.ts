/* Toast — one cute pill that bounces in over the board for every transient
   message. Replaces scattered overlay text; keeps copy short and sweet. */

export interface ToastOpts {
  tone?: 'good' | 'bad';
  ms?: number;
}

let timer: number | null = null;

export function toast(txt: string, o?: ToastOpts): void {
  const el = document.getElementById('toast');
  if (!el) return;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  /* restart the enter animation even when a toast is already showing */
  el.classList.remove('show', 'bad');
  void el.offsetWidth;
  el.textContent = txt;
  el.classList.toggle('bad', o?.tone === 'bad');
  el.classList.add('show');
  document.getElementById('cap')?.classList.add('mute');
  timer = window.setTimeout(() => {
    el.classList.remove('show');
    document.getElementById('cap')?.classList.remove('mute');
    timer = null;
  }, o?.ms ?? 1800);
}

export function hideToast(): void {
  const el = document.getElementById('toast');
  if (!el) return;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  el.classList.remove('show');
  document.getElementById('cap')?.classList.remove('mute');
}
