/* Integrity + version: corruption is caught, unknown versions rejected. */
import { describe, expect, it } from 'vitest';
import levels from '../../src/levels.json';
import type { LevelDef } from '../../src/engine/types';
import { encode, decode, CodecError } from '../../src/share/codec';

const def = (levels as unknown as LevelDef[])[3] as LevelDef;

describe('codec integrity', () => {
  it('throws on a corrupted glyph', () => {
    const code = encode(def);
    const dot = code.lastIndexOf('.');
    const body = code.slice(0, dot);
    const crc = code.slice(dot);
    const flipped = body.slice(0, -1) + (body.endsWith('0') ? 'W' : '0') + crc;
    expect(() => decode(flipped)).toThrow(CodecError);
  });
  it('throws on a corrupted checksum', () => {
    const code = encode(def);
    expect(() => decode(code + 'z')).toThrow(CodecError);
  });
  it('throws on an unknown version', () => {
    const code = encode(def).replace(/^level-\d+-/, 'level-99-');
    expect(() => decode(code)).toThrow(CodecError);
  });
  it('throws on a malformed code', () => {
    expect(() => decode('not-a-level-code')).toThrow(CodecError);
  });
  it('throws before accepting an impossible glyph stream length', () => {
    expect(() => decode('level-1-7x7-' + '0'.repeat(99) + '.abc')).toThrow(CodecError);
  });
  it('throws instead of silently dropping out-of-bounds cells while encoding', () => {
    expect(() => encode({ ...def, walls: [[99, 99]] })).toThrow(CodecError);
  });
});
