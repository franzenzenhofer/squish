/* Tiny synth — every game sound is an enveloped oscillator played through a
   warm bus (lowpass + a feathery feedback delay), tuned to one pentatonic
   scale so nothing ever clashes. Unlocks itself on the first gesture of any
   kind (iOS), resumes when the tab comes back, and persists mute. */

export interface Audio {
  unlock: () => void;
  toggleMute: () => boolean;
  isMuted: () => boolean;
  slide: () => void;
  merge: (combo: number) => void;
  split: () => void;
  beam: () => void;
  turn: () => void;
  boing: () => void;
  windy: () => void;
  hop: () => void;
  crack: () => void;
  nom: () => void;
  yum: () => void;
  squish: () => void;
  win: () => void;
  tick: () => void;
  collect: () => void;
  unlockHeart: () => void;
  scare: () => void;
  oink: () => void;
  ohno: () => void;
  talk: () => void;
  happy: () => void;
  buzz: (p: number | number[]) => void;
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
/* C-major pentatonic from C5 — the game's one scale */
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
const MUTE_KEY = 'squishy-muted';

/* repeat-prone sounds get a tiny refractory period so fast play never rattles */
const GATE_MS: Record<string, number> = {
  slide: 90, tick: 70, hop: 60, crack: 80, turn: 80, oink: 90, squish: 80, boing: 70,
  talk: 140
};

export function createAudio(): Audio {
  let ac: AudioContext | null = null;
  let bus: GainNode | null = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    /* storage blocked — start audible */
  }
  const lastPlay: Record<string, number> = {};

  const unlock = (): void => {
    if (!ac) {
      try {
        ac = new AudioContext();
        bus = ac.createGain();
        bus.gain.value = 0.3;
        /* warm everything: gentle lowpass before the speaker */
        const soften = ac.createBiquadFilter();
        soften.type = 'lowpass';
        soften.frequency.value = 4800;
        bus.connect(soften);
        soften.connect(ac.destination);
        /* feathery echo: bus -> delay -> feedback -> wet out */
        const delay = ac.createDelay(0.5);
        delay.delayTime.value = 0.16;
        const fb = ac.createGain();
        fb.gain.value = 0.3;
        const fbCut = ac.createBiquadFilter();
        fbCut.type = 'lowpass';
        fbCut.frequency.value = 2400;
        const wet = ac.createGain();
        wet.gain.value = 0.12;
        bus.connect(delay);
        delay.connect(fb);
        fb.connect(fbCut);
        fbCut.connect(delay);
        delay.connect(wet);
        wet.connect(ac.destination);
      } catch {
        ac = null;
        bus = null;
      }
    }
    if (ac && ac.state === 'suspended') void ac.resume();
  };

  /* self-contained mobile safety nets: any first gesture unlocks, and the
     context resumes when the tab becomes visible again */
  document.addEventListener('touchend', unlock, { once: true, passive: true });
  document.addEventListener('pointerdown', unlock, { once: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ac && ac.state === 'suspended') void ac.resume();
  });

  const gate = (name: string): boolean => {
    const ms = GATE_MS[name];
    if (ms === undefined) return true;
    const now = performance.now();
    if (now - (lastPlay[name] ?? -1e9) < ms) return false;
    lastPlay[name] = now;
    return true;
  };

  const tone = (
    f: number, dur: number, type: OscillatorType = 'sine',
    g = 0.12, f2?: number, delay = 0
  ): void => {
    if (!ac || !bus || muted) return;
    if (ac.state === 'suspended') {
      void ac.resume();
      return;
    }
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const gn = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 !== undefined) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    /* soft 12ms attack kills the click, exponential release breathes out */
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(g, t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn);
    gn.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.1);
  };

  /* a soft honk: triangle through a narrow bandpass — no sawtooth rasp */
  const honk = (f: number, dur: number, g: number, f2?: number, delay = 0): void => {
    if (!ac || !bus || muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const bp = ac.createBiquadFilter();
    const gn = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    if (f2 !== undefined) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 4;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(g, t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp);
    bp.connect(gn);
    gn.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.1);
  };

  return {
    unlock,
    isMuted: () => muted,
    toggleMute: (): boolean => {
      muted = !muted;
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        /* storage blocked */
      }
      return muted;
    },
    slide: () => {
      if (gate('slide')) tone(330, 0.06, 'sine', 0.03, 250);
    },
    merge: (c) => {
      const f = 523.25 * Math.pow(2, (PENTA[Math.min(c, 7)] ?? 16) / 12);
      tone(f, 0.11, 'sine', 0.11);
      tone(f * 2, 0.08, 'triangle', 0.035);
    },
    split: () => {
      tone(SCALE[2] as number, 0.05, 'sine', 0.07);
      tone(SCALE[5] as number, 0.06, 'sine', 0.07, undefined, 0.05);
    },
    beam: () => tone(SCALE[0] as number * 0.5, 0.13, 'sine', 0.07, SCALE[5]),
    turn: () => {
      if (gate('turn')) tone(SCALE[3] as number, 0.05, 'triangle', 0.05);
    },
    boing: () => {
      if (gate('boing')) tone(180, 0.13, 'sine', 0.09, 560);
    },
    windy: () => tone(540, 0.12, 'triangle', 0.045, 900),
    hop: () => {
      if (gate('hop')) tone(360, 0.1, 'sine', 0.075, 720);
    },
    crack: () => {
      if (gate('crack')) tone(900, 0.05, 'triangle', 0.04, 520);
    },
    nom: () => tone(220, 0.16, 'sine', 0.075, 90),
    yum: () => {
      tone(SCALE[1] as number, 0.09, 'sine', 0.08, SCALE[3]);
      tone(SCALE[4] as number, 0.1, 'sine', 0.06, undefined, 0.09);
    },
    squish: () => {
      if (gate('squish')) tone(420, 0.09, 'sine', 0.07, 260);
    },
    win: () => {
      [SCALE[0], SCALE[2], SCALE[4], SCALE[5], SCALE[7]].forEach((f, i) =>
        tone(f as number, 0.18, 'sine', 0.08, undefined, i * 0.09));
    },
    tick: () => {
      if (gate('tick')) tone(360, 0.04, 'triangle', 0.035);
    },
    collect: () => {
      tone(SCALE[4] as number, 0.08, 'sine', 0.09);
      tone(SCALE[6] as number, 0.1, 'sine', 0.07, undefined, 0.07);
    },
    unlockHeart: () => {
      /* rising sparkle + warm low bloom — the padlock falls away */
      [SCALE[0], SCALE[3], SCALE[5], SCALE[7]].forEach((f, i) =>
        tone(f as number, 0.14, 'sine', 0.07, undefined, i * 0.07));
      tone(SCALE[0] as number * 0.5, 0.4, 'triangle', 0.05, undefined, 0.1);
    },
    scare: () => tone(500, 0.14, 'triangle', 0.075, 180),
    oink: () => {
      if (gate('oink')) {
        honk(300, 0.07, 0.14, 420);
        honk(420, 0.07, 0.12, 300, 0.07);
      }
    },
    ohno: () => {
      tone(520, 0.18, 'sine', 0.07, 360);
      tone(390, 0.22, 'sine', 0.065, 260, 0.16);
    },
    /* a soft "boop-beep" — Squishy piping up when a bubble appears */
    talk: () => {
      if (!gate('talk')) return;
      tone(SCALE[2] as number, 0.045, 'sine', 0.05);
      tone(SCALE[4] as number, 0.05, 'sine', 0.045, undefined, 0.055);
    },
    /* a giddy rising chirp + sparkle — being petted */
    happy: () => {
      tone(SCALE[3] as number, 0.08, 'sine', 0.085, SCALE[6]);
      tone(SCALE[5] as number, 0.1, 'sine', 0.07, SCALE[7], 0.07);
      tone(SCALE[7] as number, 0.12, 'triangle', 0.04, undefined, 0.14);
    },
    buzz: (p) => {
      try {
        if (navigator.vibrate) navigator.vibrate(p);
      } catch {
        /* not supported */
      }
    }
  };
}

/** Silent Audio (null object) - the win-card replay re-fires the exact gameplay
    fx pipeline (handleFx / onEnd) for its visuals, but must stay quiet: the win
    jingle already owns the soundscape. One silent sink keeps those functions an
    SSOT instead of forking sound-free copies. */
export function silentAudio(): Audio {
  const none = (): void => undefined;
  return {
    unlock: none, toggleMute: () => true, isMuted: () => true,
    slide: none, merge: none, split: none, beam: none, turn: none, boing: none,
    windy: none, hop: none, crack: none, nom: none, yum: none, squish: none,
    win: none, tick: none, collect: none, unlockHeart: none, scare: none,
    oink: none, ohno: none, talk: none, happy: none, buzz: none
  };
}
