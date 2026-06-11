/* Tiny synth — every game sound is an enveloped oscillator, unlocked on the
   first user gesture (iOS requirement). */

export interface Audio {
  unlock: () => void;
  toggleMute: () => boolean;
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
  scare: () => void;
  oink: () => void;
  ohno: () => void;
  buzz: (p: number | number[]) => void;
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];

export function createAudio(): Audio {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;

  const unlock = (): void => {
    if (!ac) {
      try {
        ac = new AudioContext();
        master = ac.createGain();
        master.gain.value = 0.4;
        master.connect(ac.destination);
      } catch {
        ac = null;
      }
    }
    if (ac && ac.state === 'suspended') void ac.resume();
  };

  const tone = (
    f: number, dur: number, type: OscillatorType = 'sine',
    g = 0.12, f2?: number, delay = 0
  ): void => {
    if (!ac || !master || muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const gn = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2 !== undefined) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gn.gain.setValueAtTime(g, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn);
    gn.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  return {
    unlock,
    toggleMute: () => (muted = !muted),
    slide: () => tone(330, 0.06, 'sine', 0.04, 250),
    merge: (c) => {
      const f = 523 * Math.pow(2, (PENTA[Math.min(c, 7)] ?? 16) / 12);
      tone(f, 0.11, 'sine', 0.15);
      tone(f * 2, 0.08, 'triangle', 0.05);
    },
    split: () => {
      tone(660, 0.05, 'sine', 0.1);
      tone(990, 0.06, 'sine', 0.1, undefined, 0.05);
    },
    beam: () => tone(300, 0.13, 'sine', 0.09, 980),
    turn: () => tone(760, 0.05, 'triangle', 0.07),
    boing: () => tone(180, 0.13, 'sine', 0.12, 560),
    windy: () => tone(540, 0.12, 'triangle', 0.06, 900),
    hop: () => tone(360, 0.1, 'sine', 0.1, 720),
    crack: () => tone(1200, 0.05, 'triangle', 0.05, 520),
    nom: () => tone(220, 0.16, 'sine', 0.1, 90),
    yum: () => {
      tone(560, 0.09, 'sine', 0.11, 760);
      tone(840, 0.1, 'sine', 0.08, undefined, 0.09);
    },
    squish: () => tone(420, 0.09, 'sine', 0.09, 260),
    win: () => {
      [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.16, 'sine', 0.1, undefined, i * 0.09));
    },
    tick: () => tone(360, 0.04, 'triangle', 0.05),
    collect: () => {
      tone(880, 0.08, 'sine', 0.12);
      tone(1320, 0.1, 'sine', 0.09, undefined, 0.07);
    },
    scare: () => tone(500, 0.14, 'triangle', 0.1, 180),
    oink: () => {
      tone(300, 0.07, 'sawtooth', 0.06, 420);
      tone(420, 0.07, 'sawtooth', 0.05, 300, 0.07);
    },
    ohno: () => {
      tone(520, 0.18, 'sine', 0.1, 360);
      tone(390, 0.22, 'sine', 0.09, 260, 0.16);
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
