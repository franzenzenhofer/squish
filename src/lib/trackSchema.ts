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

/** numeric fields: level index, moves/swipes, par, hearts, hinted(0/1) */
const NUM_FIELDS = ['li', 'mv', 'par', 'hr', 'hd'] as const;
type NumField = (typeof NUM_FIELDS)[number];

export interface TrackEvent {
  e: EventName;
  k?: PlayKind;
  li?: number;
  mv?: number;
  par?: number;
  hr?: number;
  hd?: number;
}

const NUM_MAX = 9999;

function cleanNum(v: unknown): number | null {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return Math.min(NUM_MAX, Math.max(0, Math.floor(v)));
}

/** Whitelist-copy an untrusted payload into a TrackEvent, or null. */
export function sanitizeEvent(raw: unknown): TrackEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!EVENT_NAMES.includes(r.e as EventName)) return null;
  const ev: TrackEvent = { e: r.e as EventName };
  if (KINDS.includes(r.k as PlayKind)) ev.k = r.k as PlayKind;
  for (const f of NUM_FIELDS) {
    const n = cleanNum(r[f]);
    if (n !== null) ev[f as NumField] = n;
  }
  /* hinted is a boolean counter — clamp to 0/1 */
  if (ev.hd !== undefined) ev.hd = Math.min(1, ev.hd);
  return ev;
}
