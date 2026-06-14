/* CRC32 (reflected, poly 0xEDB88320) — a tiny dependency-free integrity check
   for share codes. Detects accidental corruption (a dropped/altered char in a
   pasted link); it is not cryptographic. */

const TABLE: number[] = (() => {
  const t = new Array<number>(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC32 of a string's UTF-16 code units, returned as an unsigned 32-bit int. */
export function crc32(str: string): number {
  let crc = 0xffffffff;
  for (let i = 0; i < str.length; i++) {
    crc = TABLE[(crc ^ str.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Compact, url-safe base36 form of the CRC32. */
export function crc32Base36(str: string): string {
  return crc32(str).toString(36);
}
