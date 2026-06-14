/* Client tracker — fire-and-forget anonymous counters. The transport is
   injected (navigator.sendBeacon in the game, a stub in tests). Tracking is
   best-effort by design: it never throws and never blocks gameplay. */
import { sanitizeEvent, type EventName, type Platform, type TrackEvent } from './trackSchema';

export interface TrackerOpts {
  enabled: boolean;
  /** build target tag stamped onto every event (web | ios) */
  platform: Platform;
  /** the daily-rotating anonymous token stamped on every event (issue #6) */
  token?: () => string;
  /** transport: receives the JSON body; returns whether it was queued */
  send: (body: string) => boolean;
}

export interface Tracker {
  track: (e: EventName, fields?: Omit<TrackEvent, 'e'>) => void;
}

export function createTracker(o: TrackerOpts): Tracker {
  return {
    track: (e, fields): void => {
      if (!o.enabled) return;
      try {
        const ev = sanitizeEvent({ ...fields, e, p: o.platform, t: o.token?.() });
        if (!ev) return;
        o.send(JSON.stringify(ev));
      } catch {
        /* analytics must never break the game */
      }
    }
  };
}
