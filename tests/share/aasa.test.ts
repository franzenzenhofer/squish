/* The worker serves a valid Apple App Site Association for Universal Links, and
   does not disturb the existing /t and asset behaviour. */
import { describe, expect, it } from 'vitest';
import worker from '../../src/worker';
import type { TrackEnv } from '../../src/worker';

const env = (): TrackEnv => ({
  SQUISH_EVENTS: { writeDataPoint: () => undefined },
  ASSETS: { fetch: () => Promise.resolve(new Response('asset', { headers: { 'content-type': 'text/html' } })) }
});

describe('apple-app-site-association', () => {
  it('serves valid JSON with the right content-type', async () => {
    const res = await worker.fetch(
      new Request('https://squishy.franzai.com/.well-known/apple-app-site-association'),
      env()
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    const body = await res.json() as { applinks: { details: { appID: string }[] } };
    expect(body.applinks.details[0]?.appID).toBe('7D2YX5DQ6M.com.franzai.squish');
  });

  it('still answers POST /t with 204', async () => {
    const res = await worker.fetch(
      new Request('https://squishy.franzai.com/t', { method: 'POST', body: '{"e":"x"}' }),
      env()
    );
    expect(res.status).toBe(204);
  });

  it('passes other paths through to assets', async () => {
    const res = await worker.fetch(new Request('https://squishy.franzai.com/'), env());
    expect(await res.text()).toBe('asset');
  });
});
