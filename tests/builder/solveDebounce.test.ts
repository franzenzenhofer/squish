/* Supersede logic: when edits outpace the solver, only the latest solve drives
   the status, so the pill never shows a stale verdict. */
import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../../src/engine/types';
import { createSolveRunner, type SolveOutcome, type SolveStatus } from '../../src/builder/solveDebounce';

const def: LevelDef = { w: 3, h: 3, target: [0, 0], dots: [[2, 2]], par: 1 };

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('createSolveRunner', () => {
  it('sets checking immediately then the resolved status', async () => {
    const statuses: SolveStatus[] = [];
    const runner = createSolveRunner(() => Promise.resolve('solvable'), (st) => statuses.push(st));
    runner.run(def);
    await Promise.resolve();
    expect(statuses[0]).toBe('checking');
    expect(statuses.at(-1)).toBe('solvable');
  });

  it('ignores a stale (superseded) solve result', async () => {
    const a = deferred<SolveOutcome>();
    const b = deferred<SolveOutcome>();
    const queue = [a.promise, b.promise];
    const statuses: SolveStatus[] = [];
    const runner = createSolveRunner(() => queue.shift() as Promise<SolveOutcome>, (st) => statuses.push(st));
    runner.run(def); // starts A
    runner.run(def); // starts B, supersedes A
    b.resolve('solvable');
    await b.promise;
    await Promise.resolve();
    a.resolve('unsolvable'); // stale, must be ignored
    await a.promise;
    await Promise.resolve();
    expect(statuses).not.toContain('unsolvable');
    expect(statuses.at(-1)).toBe('solvable');
  });

  it('ignores a pending solve after cancellation', async () => {
    const pending = deferred<SolveOutcome>();
    const statuses: SolveStatus[] = [];
    const runner = createSolveRunner(() => pending.promise, (st) => statuses.push(st));

    runner.run(def);
    runner.cancel('idle');
    pending.resolve('solvable');
    await pending.promise;
    await Promise.resolve();

    expect(statuses).toEqual(['checking', 'idle']);
  });
});
