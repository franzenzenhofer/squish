/* Anonymous analytics — the privacy contract, enforced by tests. Events are
   counters only: a whitelisted event name plus whitelisted numeric fields.
   Anything else (strings, identifiers, unknown keys) is dropped at the
   schema layer on BOTH sides (client tracker and worker), so no identifying
   data can ever reach storage. No cookies, no IDs, no exceptions. */
import { describe, expect, it } from 'vitest';
import { EVENT_NAMES, sanitizeEvent } from '../src/lib/trackSchema';
import { createTracker } from '../src/lib/track';
import worker, { type TrackEnv } from '../src/worker';

describe('trackSchema.sanitizeEvent (the anonymity contract)', () => {
  it('accepts a whitelisted event with whitelisted numeric fields', () => {
    const ev = sanitizeEvent({ e: 'win', k: 'c', li: 12, mv: 7, par: 6, hr: 2, hd: 0 });
    expect(ev).toEqual({ e: 'win', k: 'c', li: 12, mv: 7, par: 6, hr: 2, hd: 0 });
  });

  it('rejects unknown event names', () => {
    expect(sanitizeEvent({ e: 'pageview' })).toBeNull();
    expect(sanitizeEvent({ e: '' })).toBeNull();
    expect(sanitizeEvent({})).toBeNull();
    expect(sanitizeEvent(null)).toBeNull();
    expect(sanitizeEvent('boot')).toBeNull();
  });

  it('drops every non-whitelisted key - identifiers can never pass', () => {
    const ev = sanitizeEvent({
      e: 'boot', userId: 'abc', email: 'x@y.z', ip: '1.2.3.4', ua: 'Safari', li: 3
    });
    expect(ev).toEqual({ e: 'boot', li: 3 });
    expect(JSON.stringify(ev)).not.toContain('abc');
  });

  it('drops non-numeric values in numeric fields and clamps to sane ints', () => {
    expect(sanitizeEvent({ e: 'win', li: 'twelve' })).toEqual({ e: 'win' });
    expect(sanitizeEvent({ e: 'win', mv: -5 })).toEqual({ e: 'win', mv: 0 });
    expect(sanitizeEvent({ e: 'win', mv: 7.9 })).toEqual({ e: 'win', mv: 7 });
    expect(sanitizeEvent({ e: 'win', mv: 1e9 })).toEqual({ e: 'win', mv: 9999 });
    expect(sanitizeEvent({ e: 'win', mv: Number.NaN })).toEqual({ e: 'win' });
  });

  it('clamps the hinted flag to a boolean 0/1', () => {
    expect(sanitizeEvent({ e: 'win', hd: 7 })).toEqual({ e: 'win', hd: 1 });
    expect(sanitizeEvent({ e: 'win', hd: 0 })).toEqual({ e: 'win', hd: 0 });
  });

  it('restricts the play-kind to single known letters', () => {
    expect(sanitizeEvent({ e: 'start', k: 'c' })).toEqual({ e: 'start', k: 'c' });
    expect(sanitizeEvent({ e: 'start', k: 'd' })).toEqual({ e: 'start', k: 'd' });
    expect(sanitizeEvent({ e: 'start', k: 'something-long' })).toEqual({ e: 'start' });
  });

  it('knows exactly the eight gameplay events', () => {
    expect([...EVENT_NAMES].sort()).toEqual(
      ['boot', 'hint', 'lose', 'ohno', 'quit', 'share', 'start', 'win'].sort());
  });
});

describe('createTracker (client)', () => {
  it('sends a sanitized JSON body through the injected transport, stamped with its platform', () => {
    const sent: string[] = [];
    const t = createTracker({ enabled: true, platform: 'web', send: (b) => { sent.push(b); return true; } });
    t.track('win', { li: 4, mv: 6, par: 6, hr: 3, hd: 0, k: 'c' });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0] as string)).toEqual(
      { e: 'win', k: 'c', p: 'web', li: 4, mv: 6, par: 6, hr: 3, hd: 0 });
  });

  it('stamps the ios platform on every event from the ios build', () => {
    const sent: string[] = [];
    const t = createTracker({ enabled: true, platform: 'ios', send: (b) => { sent.push(b); return true; } });
    t.track('boot');
    expect(JSON.parse(sent[0] as string)).toEqual({ e: 'boot', p: 'ios' });
  });

  it('sends nothing when disabled', () => {
    const sent: string[] = [];
    const t = createTracker({ enabled: false, platform: 'web', send: (b) => { sent.push(b); return true; } });
    t.track('boot');
    expect(sent).toHaveLength(0);
  });

  it('silently drops invalid events and never throws', () => {
    const t = createTracker({
      enabled: true,
      platform: 'web',
      send: () => { throw new Error('network down'); }
    });
    expect(() => t.track('win', { li: 1 })).not.toThrow();
    expect(() => t.track('nope' as never)).not.toThrow();
  });
});

describe('platform flag (one dataset, web vs ios)', () => {
  it('keeps a whitelisted platform value', () => {
    expect(sanitizeEvent({ e: 'boot', p: 'web' })).toEqual({ e: 'boot', p: 'web' });
    expect(sanitizeEvent({ e: 'boot', p: 'ios' })).toEqual({ e: 'boot', p: 'ios' });
  });

  it('omits an unknown platform value (so the worker drops the tampered payload whole)', () => {
    expect(sanitizeEvent({ e: 'boot', p: 'android' })).toEqual({ e: 'boot' });
  });
});

/* ----------------------------- worker ----------------------------------- */

interface Point { blobs?: string[]; doubles?: number[]; indexes?: string[] }

function makeEnv(): { env: TrackEnv; points: Point[]; assetCalls: Request[] } {
  const points: Point[] = [];
  const assetCalls: Request[] = [];
  const env: TrackEnv = {
    SQUISH_EVENTS: { writeDataPoint: (p) => { points.push(p as Point); } },
    ASSETS: {
      fetch: (req: Request) => {
        assetCalls.push(req);
        return Promise.resolve(new Response('asset', { status: 200 }));
      }
    }
  };
  return { env, points, assetCalls };
}

function post(body: unknown): Request {
  return new Request('https://squishy.franzai.com/t', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

describe('worker /t endpoint', () => {
  it('stores a valid event as an anonymous datapoint and returns 204', async () => {
    const { env, points } = makeEnv();
    const res = await worker.fetch(post({ e: 'win', k: 'c', p: 'web', li: 9, mv: 8, par: 7, hr: 1, hd: 1 }), env);
    expect(res.status).toBe(204);
    expect(points).toHaveLength(1);
    /* GOLDEN: identical to before except the added platform blob (blobs[2]) */
    expect(points[0]).toEqual({
      blobs: ['win', 'c', 'web'],
      doubles: [9, 8, 7, 1, 1],
      indexes: ['win']
    });
  });

  it('BACKWARD COMPAT: an old client body with no platform is stored as web', async () => {
    const { env, points } = makeEnv();
    const res = await worker.fetch(post({ e: 'win', k: 'c', li: 9, mv: 8, par: 7, hr: 1, hd: 1 }), env);
    expect(res.status).toBe(204);
    expect(points[0]?.blobs).toEqual(['win', 'c', 'web']);
  });

  it('tags an ios event with the ios platform blob', async () => {
    const { env, points } = makeEnv();
    await worker.fetch(post({ e: 'start', k: 'c', p: 'ios' }), env);
    expect(points[0]?.blobs).toEqual(['start', 'c', 'ios']);
  });

  it('drops a tampered platform value whole (still 204, nothing stored)', async () => {
    const { env, points } = makeEnv();
    const res = await worker.fetch(post({ e: 'boot', p: 'android' }), env);
    expect(res.status).toBe(204);
    expect(points).toHaveLength(0);
  });

  it('answers the CORS preflight and tags /t responses for the app:// origin', async () => {
    const { env } = makeEnv();
    const pre = await worker.fetch(
      new Request('https://squishy.franzai.com/t', { method: 'OPTIONS' }), env);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    const res = await worker.fetch(post({ e: 'boot', p: 'ios' }), env);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('never sets cookies', async () => {
    const { env } = makeEnv();
    const res = await worker.fetch(post({ e: 'boot' }), env);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('drops invalid payloads without storing anything (still 204 - fire and forget)', async () => {
    const { env, points } = makeEnv();
    expect((await worker.fetch(post({ e: 'evil', email: 'x@y.z' }), env)).status).toBe(204);
    expect((await worker.fetch(post('not json {'), env)).status).toBe(204);
    expect(points).toHaveLength(0);
  });

  it('ignores oversized bodies', async () => {
    const { env, points } = makeEnv();
    const res = await worker.fetch(post({ e: 'boot', pad: 'x'.repeat(10000) }), env);
    expect(res.status).toBe(204);
    expect(points).toHaveLength(0);
  });

  it('serves everything else from the static assets', async () => {
    const { env, points, assetCalls } = makeEnv();
    const res = await worker.fetch(new Request('https://squishy.franzai.com/'), env);
    expect(await res.text()).toBe('asset');
    expect(assetCalls).toHaveLength(1);
    expect(points).toHaveLength(0);
  });

  it('GET /t is not a tracking call - falls through to assets', async () => {
    const { env, points } = makeEnv();
    await worker.fetch(new Request('https://squishy.franzai.com/t'), env);
    expect(points).toHaveLength(0);
  });
});

describe('worker cache headers (a reload always shows the new version)', () => {
  function envWith(contentType: string): TrackEnv {
    return {
      SQUISH_EVENTS: { writeDataPoint: () => undefined },
      ASSETS: {
        fetch: () => Promise.resolve(
          new Response('x', { status: 200, headers: { 'content-type': contentType } }))
      }
    };
  }

  it('HTML is never cached stale - browsers must revalidate every load', async () => {
    const res = await worker.fetch(
      new Request('https://squishy.franzai.com/'), envWith('text/html; charset=utf-8'));
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('hashed build assets cache forever - their names change per deploy', async () => {
    const res = await worker.fetch(
      new Request('https://squishy.franzai.com/assets/main-B0DVlwOf.js'),
      envWith('text/javascript'));
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });
});
