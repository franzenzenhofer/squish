/* "Your Creations" CRUD over a key-value store (localStorage in the app, a fake
   here). Save/list/get/delete; list stays ordered; deletes are isolated. */
import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../../src/engine/types';
import {
  saveCreation, listCreations, getCreation, deleteCreation, updateCreation, type KV
} from '../../src/builder/library';

function fakeKV(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k)
  };
}

const def = (par: number): LevelDef => ({ w: 4, h: 4, target: [0, 0], dots: [[3, 3]], par });

describe('creations library', () => {
  it('saves and lists in insertion order', () => {
    const kv = fakeKV();
    const a = saveCreation(kv, def(3), 'Alpha');
    const b = saveCreation(kv, def(5), 'Beta');
    const list = listCreations(kv);
    expect(list.map((c) => c.id)).toEqual([a, b]);
    expect(list.map((c) => c.name)).toEqual(['Alpha', 'Beta']);
    expect(list[1]?.par).toBe(5);
  });
  it('gets a full creation back', () => {
    const kv = fakeKV();
    const id = saveCreation(kv, def(7), 'Gamma');
    const got = getCreation(kv, id);
    expect(got?.def.par).toBe(7);
    expect(got?.name).toBe('Gamma');
  });
  it('updates a creation def in place', () => {
    const kv = fakeKV();
    const id = saveCreation(kv, def(2), 'D');
    updateCreation(kv, id, def(9));
    expect(getCreation(kv, id)?.def.par).toBe(9);
    expect(listCreations(kv)).toHaveLength(1);
  });
  it('deletes one without disturbing others', () => {
    const kv = fakeKV();
    const a = saveCreation(kv, def(1), 'A');
    const b = saveCreation(kv, def(2), 'B');
    deleteCreation(kv, a);
    const list = listCreations(kv);
    expect(list.map((c) => c.id)).toEqual([b]);
    expect(getCreation(kv, a)).toBeNull();
  });
  it('tolerates a dangling id in the list', () => {
    const kv = fakeKV();
    const a = saveCreation(kv, def(1), 'A');
    kv.removeItem('squish-custom:' + a); // item gone, list still references it
    expect(listCreations(kv)).toEqual([]);
  });
  it('filters corrupted non-string ids instead of crashing on save', () => {
    const kv = fakeKV();
    kv.setItem('squish-custom-list', JSON.stringify([1, null, 'c4']));

    const id = saveCreation(kv, def(8), 'Recovered');

    expect(id).toBe('c5');
    expect(listCreations(kv).map((c) => c.id)).toEqual(['c5']);
  });
});

describe('shared-with-you shelf (no self-spam)', () => {
  it('is idempotent on the share code — same link never duplicates', async () => {
    const { saveShared, listShared, hasSharedCode } = await import('../../src/builder/library');
    const kv = fakeKV();
    const id1 = saveShared(kv, def(4), 'CODE-A', 'Shared');
    const id2 = saveShared(kv, def(4), 'CODE-A', 'Shared'); // same code again
    expect(id1).toBe(id2);
    expect(listShared(kv).length).toBe(1);
    expect(hasSharedCode(kv, 'CODE-A')).toBe(true);
    expect(hasSharedCode(kv, 'CODE-B')).toBe(false);
  });
  it('keeps distinct codes and deletes in isolation', async () => {
    const { saveShared, listShared, deleteShared } = await import('../../src/builder/library');
    const kv = fakeKV();
    const a = saveShared(kv, def(4), 'CODE-A', 'A');
    saveShared(kv, def(5), 'CODE-B', 'B');
    expect(listShared(kv).length).toBe(2);
    deleteShared(kv, a);
    expect(listShared(kv).map((c) => c.id)).not.toContain(a);
    expect(listShared(kv).length).toBe(1);
  });
});
