import { describe, expect, it } from 'vitest';
import { getSettings, updateSettings, type AfterWin } from '../../src/game/settings';

describe('settings updates', () => {
  it('ignores invalid after-win values from programmatic patches', () => {
    updateSettings({ afterWin: 'wait' });
    updateSettings({ afterWin: 'oops' as unknown as AfterWin });
    expect(getSettings().afterWin).toBe('wait');
  });
});
