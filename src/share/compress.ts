/* zip-style compression for the share URL: a packed level (mostly-empty byte
   grid) is DEFLATE-compressed and base64url-encoded, so the link is short and
   tidy. Synchronous (fflate), so encode/decode stay sync and the codec/boot
   path needs no async plumbing. */
import { deflateSync, inflateSync } from 'fflate';

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DEFLATE + base64url. */
export function compress(bytes: Uint8Array): string {
  return toBase64Url(deflateSync(bytes, { level: 9 }));
}

/** Inverse of compress(). Throws on a corrupt/invalid payload. */
export function decompress(b64: string): Uint8Array {
  return inflateSync(fromBase64Url(b64));
}
