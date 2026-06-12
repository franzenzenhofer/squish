/* Client tracker — fire-and-forget anonymous counters. The transport is
   injected (navigator.sendBeacon in the game, a stub in tests). Tracking is
   best-effort by design: it never throws and never blocks gameplay. */
import { sanitizeEvent, type EventName, type TrackEvent } from './trackSchema';

export interface TrackerOpts {
  enabled: boolean;
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
        const ev = sanitizeEvent({ ...fields, e });
        if (!ev) return;
        o.send(JSON.stringify(ev));
      } catch {
        /* analytics must never break the game */
      }
    }
  };
}
