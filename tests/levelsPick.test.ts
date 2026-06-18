import { describe, expect, it } from 'vitest';
import { furthest } from '../src/game/levelsPick';
import { blankSession } from '../src/game/session';

describe('levels picker progress reach', () => {
  it('ignores corrupted non-level result keys', () => {
    const s = blankSession();
    const corruptResults: Record<string, number> = { oops: 3, 2: 4 };
    const corruptHinted: Record<string, true> = { nope: true, 4: true };
    s.results = corruptResults as unknown as Record<number, number>;
    s.hinted = corruptHinted as unknown as Record<number, true>;

    expect(furthest(s)).toBe(5);
  });
});
