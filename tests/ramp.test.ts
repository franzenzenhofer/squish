/* The endless ladder contract: difficulty NEVER steps back. Every dial
   (par rung, walls, fields, friends) is non-decreasing in the level number,
   the par rung keeps climbing into the 20-30 range by L150-L200, and the
   very-high rungs always carry the star-tour cast (the proven generator
   lever for long optimal lines). Curated 1-40 stay exactly as tuned. */
import { describe, expect, it } from 'vitest';
import { ramp } from '../src/gen/ramp';

describe('endless ramp (51+) - harder and harder, forever', () => {
  it('the trio arc 41-50 carries 3 friends and climbs par 10 -> 13', () => {
    let prev = 0;
    for (let n = 41; n <= 50; n++) {
      const p = ramp(n);
      expect(p.friends.length, 'L' + n).toBe(3);
      expect(p.parTarget, 'L' + n).toBeGreaterThanOrEqual(prev);
      prev = p.parTarget;
    }
    expect(ramp(41).parTarget).toBe(10);
    expect(ramp(50).parTarget).toBe(13);
  });

  it('the par rung never decreases from 51 to 400', () => {
    let prev = 0;
    for (let n = 51; n <= 400; n++) {
      const p = ramp(n);
      expect(p.parTarget, 'L' + n).toBeGreaterThanOrEqual(prev);
      prev = p.parTarget;
    }
  });

  it('keeps climbing into marathon territory: 16+ by L100, 20+ by L150, 28+ by L200', () => {
    expect(ramp(100).parTarget).toBeGreaterThanOrEqual(16);
    expect(ramp(150).parTarget).toBeGreaterThanOrEqual(20);
    expect(ramp(200).parTarget).toBeGreaterThanOrEqual(28);
    expect(ramp(400).parTarget).toBeLessThanOrEqual(30);
  });

  it('par bands are sane and floor-only (never below the rung - 0)', () => {
    for (let n = 41; n <= 400; n += 7) {
      const p = ramp(n);
      expect(p.parMin).toBeGreaterThanOrEqual(p.parTarget - 0);
      expect(p.parMax).toBeGreaterThanOrEqual(p.parMin);
    }
  });

  it('mechanics load only grows: walls, fields, friends', () => {
    let walls = 0;
    let fields = 0;
    let friends = 0;
    for (let n = 51; n <= 400; n++) {
      const p = ramp(n);
      expect(p.wallMax, 'walls L' + n).toBeGreaterThanOrEqual(walls);
      expect(p.fields.length, 'fields L' + n).toBeGreaterThanOrEqual(fields);
      expect(p.friends.length, 'friends L' + n).toBeGreaterThanOrEqual(friends);
      walls = p.wallMax;
      fields = p.fields.length;
      friends = p.friends.length;
    }
  });

  it('marathon rungs (par 12+) always feature the star tour, never panda/chick', () => {
    for (let n = 51; n <= 400; n++) {
      const p = ramp(n);
      if (p.parTarget < 12) continue;
      expect(p.friends, 'L' + n).toContain('star');
      expect(p.friends, 'L' + n).not.toContain('panda');
      expect(p.friends, 'L' + n).not.toContain('chick');
      expect(p.starMax ?? 2, 'L' + n).toBeGreaterThanOrEqual(3);
    }
  });

  it('starMax grows with the rung (longer tours for higher rungs)', () => {
    expect(ramp(200).starMax ?? 0).toBeGreaterThanOrEqual(ramp(100).starMax ?? 0);
    expect(ramp(200).starMax ?? 0).toBeLessThanOrEqual(5);
  });

  it('marathon rungs keep full-size boards (no panda/chick shrink)', () => {
    for (let n = 80; n <= 400; n += 13) {
      expect(ramp(n).w, 'L' + n).toBe(7);
    }
  });

  it('high rungs accept headroom ABOVE the floor (no window starvation)', () => {
    /* the par distribution disperses at high rungs - a 2-wide window finds
       nothing (measured: rung 23 failed every round while par 26-34
       candidates were being rejected). The floor is law; the ceiling breathes. */
    for (let n = 51; n <= 400; n += 3) {
      const p = ramp(n);
      const head = p.parMax - p.parTarget;
      if (p.parTarget >= 18) expect(head, 'L' + n).toBeGreaterThanOrEqual(8);
      else expect(head, 'L' + n).toBeGreaterThanOrEqual(2);
      expect(p.parPrefer, 'L' + n).toBe('exact');
    }
  });

  it('never pairs a friend with itself (exclusion walks must not collapse)', () => {
    for (let n = 41; n <= 400; n++) {
      /* covers the hand-written trio arc AND the generated ladder */
      const f = ramp(n).friends;
      expect(new Set(f).size, 'L' + n + ' ' + f.join(',')).toBe(f.length);
    }
  });

  it('curated 1-40 stay exactly as hand-tuned', () => {
    expect(ramp(26).parTarget).toBe(5);
    expect(ramp(28).parMin).toBe(6);
    expect(ramp(40).parMin).toBe(9);
    expect(ramp(40).friends).toEqual(['pig', 'star', 'bunny']);
  });
});
