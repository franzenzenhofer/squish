import { describe, it, expect } from 'vitest';
import { heartsFor } from '../src/game/rating';

describe('heartsFor — heart rating bands', () => {
  it('awards 3 hearts at optimal or one over (moves <= par + 1)', () => {
    expect(heartsFor(6, 6)).toBe(3);   // exactly par
    expect(heartsFor(5, 6)).toBe(3);   // better than par
    expect(heartsFor(7, 6)).toBe(3);   // par + 1
  });

  it('awards 2 hearts from par+2 up to double par (moves <= par * 2)', () => {
    expect(heartsFor(8, 6)).toBe(2);   // par + 2
    expect(heartsFor(12, 6)).toBe(2);  // exactly 2x par
  });

  it('awards 1 heart for anything worse than double par', () => {
    expect(heartsFor(13, 6)).toBe(1);  // just over 2x par
    expect(heartsFor(99, 6)).toBe(1);
  });

  it('par + 1 always wins the 3-heart band even for tiny par', () => {
    expect(heartsFor(2, 1)).toBe(3);   // par 1: par+1 == 2x par == 2 -> 3 hearts
    expect(heartsFor(3, 1)).toBe(1);   // worse than 2x par
  });
});
