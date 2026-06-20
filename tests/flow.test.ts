/* Flow decisions as pure functions — the hint bulb's visibility and the boot
   resume target. These guard two play-tested bugs: the hint must never show in
   daily, and "Continue" must always resume the campaign level, never the daily
   that was last played. */
import { describe, expect, it } from 'vitest';
import { bootPlan, hintHidden, winResumeLi } from '../src/game/flow';
import { resumeSnapshot } from '../src/game/persist';
import { blankSession } from '../src/game/session';

describe('hintHidden', () => {
  it('honours the setting in campaign', () => {
    expect(hintHidden(true, { kind: 'campaign' })).toBe(false);
    expect(hintHidden(false, { kind: 'campaign' })).toBe(true);
  });
  it('always hides the bulb in daily, even when the setting is on', () => {
    expect(hintHidden(true, { kind: 'daily', date: '2026-06-13' })).toBe(true);
  });
});

describe('bootPlan', () => {
  it('starts the daily on a #daily deep-link', () => {
    expect(bootPlan(42, '#daily')).toEqual({ daily: true, li: 42 });
  });
  it('resumes the saved campaign level for any other hash', () => {
    expect(bootPlan(42, '')).toEqual({ daily: false, li: 42 });
    expect(bootPlan(7, '#whatever')).toEqual({ daily: false, li: 7 });
  });
  it('opens the editor on #builder', () => {
    expect(bootPlan(5, '#builder')).toEqual({ daily: false, li: 5, builder: true });
  });
  it('carries an editor glyph code on #level-<v>-<w>x<h>-...', () => {
    expect(bootPlan(5, '#level-1-3x3-M00000002.abc'))
      .toEqual({ daily: false, li: 5, shared: 'level-1-3x3-M00000002.abc' });
  });
  it('routes a campaign-share #level-<n>-<key> to campaignShare, not the importer', () => {
    expect(bootPlan(5, '#level-7-abc123'))
      .toEqual({ daily: false, li: 5, campaignShare: { li: 6, key: 'abc123' } });
  });
});

describe('winResumeLi', () => {
  it('a campaign win steps forward one level', () => {
    expect(winResumeLi({ kind: 'campaign' }, 9)).toBe(10);
  });
  it('a daily win resumes the next open level, never the daily', () => {
    expect(winResumeLi({ kind: 'daily', date: '2026-06-20' }, 9)).toBe(9);
  });
  it('a shared/custom win drops back into the next open level (never the overview)', () => {
    /* player whose next open level is index 10 plays a shared level out of order
       and wins -> back to their own index 10, NOT shared-level+1, NOT a picker */
    expect(winResumeLi({ kind: 'custom', source: 'shared' }, 10)).toBe(10);
  });
});

describe('resumeSnapshot', () => {
  it('never makes the daily a resume target — coerces to the campaign pointer', () => {
    const s = blankSession();
    s.li = 42;
    s.play = { kind: 'daily', date: '2026-06-13' };
    const snap = resumeSnapshot(s);
    expect(snap.play).toEqual({ kind: 'campaign' });
    expect(snap.li).toBe(42);
    expect(snap.def).toBeNull();
  });
  it('keeps the campaign level and its def', () => {
    const s = blankSession();
    s.li = 5;
    s.play = { kind: 'campaign' };
    const snap = resumeSnapshot(s);
    expect(snap.play).toEqual({ kind: 'campaign' });
    expect(snap.li).toBe(5);
    expect(snap.def).toBe(s.def);
  });
  it('never makes a custom level a resume target', () => {
    const s = blankSession();
    s.li = 9;
    s.play = { kind: 'custom', source: 'saved' };
    const snap = resumeSnapshot(s);
    expect(snap.play).toEqual({ kind: 'campaign' });
    expect(snap.li).toBe(9);
    expect(snap.def).toBeNull();
  });
});
