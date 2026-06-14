/* Cloudflare worker — serves the static game and accepts anonymous gameplay
   counters on POST /t, written to Workers Analytics Engine. Privacy by
   construction: the shared schema whitelist drops everything but an event
   name and small integers; no cookies are ever set, no IP or user agent is
   stored, every event stands alone (nothing links two events to one player). */
import { sanitizeEvent } from './lib/trackSchema';

interface AnalyticsEngineDataset {
  writeDataPoint: (point: {
    blobs?: string[]; doubles?: number[]; indexes?: string[];
  }) => void;
}

export interface TrackEnv {
  SQUISH_EVENTS: AnalyticsEngineDataset;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

const BODY_MAX = 256;

/* Apple App Site Association — lets the installed iOS app claim
   https://squishy.franzai.com links (Universal Links). The shared level lives in
   the URL fragment (#level-...), which the app's in-page router reads after the
   OS hands off, so any path opens the app. Served from the worker so the exact
   application/json content-type and no-redirect contract Apple requires hold. */
const AASA = JSON.stringify({
  applinks: {
    apps: [],
    details: [{
      appID: '7D2YX5DQ6M.com.franzai.squish',
      appIDs: ['7D2YX5DQ6M.com.franzai.squish'],
      paths: ['*'],
      components: [{ '/': '*' }]
    }]
  }
});

export default {
  async fetch(req: Request, env: TrackEnv): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/.well-known/apple-app-site-association') {
      return new Response(AASA, { headers: { 'content-type': 'application/json' } });
    }
    if (req.method === 'POST' && url.pathname === '/t') {
      /* fire-and-forget: always 204, never cookies, never an error page */
      try {
        const body = await req.text();
        if (body.length <= BODY_MAX) {
          const raw: unknown = JSON.parse(body);
          /* a key outside the whitelist means a tampered payload — drop it
             whole rather than salvage (fail hard on anything unexpected) */
          const ev = sanitizeEvent(raw);
          const clean = ev !== null &&
            Object.keys(raw as object).every((k) => k in ev);
          if (ev && clean) {
            env.SQUISH_EVENTS.writeDataPoint({
              blobs: [ev.e, ev.k ?? ''],
              doubles: [ev.li ?? -1, ev.mv ?? -1, ev.par ?? -1, ev.hr ?? -1, ev.hd ?? -1],
              indexes: [ev.e]
            });
          }
        }
      } catch {
        /* malformed body — nothing stored */
      }
      return new Response(null, { status: 204 });
    }
    /* freshness contract: HTML always revalidates (a reload shows every new
       deploy immediately - the etag makes the check a cheap 304), while the
       hashed /assets/* files are immutable and cache forever */
    const res = await env.ASSETS.fetch(req);
    const out = new Response(res.body, res);
    if (url.pathname.startsWith('/assets/')) {
      out.headers.set('cache-control', 'public, max-age=31536000, immutable');
    } else if (out.headers.get('content-type')?.includes('text/html')) {
      out.headers.set('cache-control', 'no-cache');
    }
    return out;
  }
};
