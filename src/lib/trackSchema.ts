/* Anonymous analytics schema — the privacy contract (SSOT, shared by the
   client tracker and the Cloudflare worker). An event is a whitelisted name
   plus whitelisted small integers. Strings, identifiers and unknown keys are
   dropped here, on both ends, so identifying data can never reach storage. */

export const EVENT_NAMES = [
  'boot', 'start', 'win', 'lose', 'ohno', 'hint', 'share', 'quit'
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** play kind: c = campaign, d = daily, g = debug/test */
const KINDS = ['c', 'd', 'g'] as const;
export type PlayKind = (typeof KINDS)[number];

/** build target the event came from: web = hosted site, ios = the offline app.
   ONE dataset holds both; this flag is the only thing that splits them. An
   absent flag means 'web' (old/cached clients predate the field). */
const PLATFORMS = ['web', 'ios'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** numeric fields: level index, moves/swipes, par, hearts, hinted(0/1) */
const NUM_FIELDS = ['li', 'mv', 'par', 'hr', 'hd'] as const;
type NumField = (typeof NUM_FIELDS)[number];

export interface TrackEvent {
  e: EventName;
  k?: PlayKind;
  /** build target: 'web' (also the default when absent) or 'ios' */
  p?: Platform;
  li?: number;
  mv?: number;
  par?: number;
  hr?: number;
  hd?: number;
  /** daily-rotating anonymous token: a fresh random value per calendar day that
      is discarded at the day boundary. NOT a persistent identifier - it lets
      COUNT(DISTINCT) approximate daily unique players/playstarts WITHOUT building
      a cross-day profile, so the consent-free privacy posture holds. */
  t?: string;
}

const NUM_MAX = 9999;
const TOKEN_MAX = 16;

function cleanNum(v: unknown): number | null {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return Math.min(NUM_MAX, Math.max(0, Math.floor(v)));
}

/** The token is the ONLY free string we accept — hard-sanitized to a short
    lowercase alphanumeric value so nothing identifying can ever ride along. */
function cleanToken(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, TOKEN_MAX);
  return t.length ? t : undefined;
}

/** Whitelist-copy an untrusted payload into a TrackEvent, or null. */
export function sanitizeEvent(raw: unknown): TrackEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!EVENT_NAMES.includes(r.e as EventName)) return null;
  const ev: TrackEvent = { e: r.e as EventName };
  if (KINDS.includes(r.k as PlayKind)) ev.k = r.k as PlayKind;
  if (PLATFORMS.includes(r.p as Platform)) ev.p = r.p as Platform;
  for (const f of NUM_FIELDS) {
    const n = cleanNum(r[f]);
    if (n !== null) ev[f as NumField] = n;
  }
  /* hinted is a boolean counter — clamp to 0/1 */
  if (ev.hd !== undefined) ev.hd = Math.min(1, ev.hd);
  const t = cleanToken(r.t);
  if (t) ev.t = t;
  return ev;
}
