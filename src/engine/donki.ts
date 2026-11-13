// Card D8: the live NASA call (guide 2.3).
// Strongest flare of the last 7 days (UTC) from DONKI. An empty list is a real answer (a quiet week).
// Only a failed call (no network, an error, or more than 6 seconds) uses the archived 10 Sept 2017 X8.2.
// The result is cached for the session, so a reload doesn't change the difficulty.
import { flareRank, shieldLineForClass } from './rules';

export interface D8Result {
  source: 'LIVE' | 'ARCHIVED';
  classType: string | null; // null = no flares this week
  peakTime: string | null;
  flrID: string | null;
  fetchedAt: string; // ISO time of the fetch (or of the fallback)
  cubes: 1 | 2 | 3;
  error?: string;
}

const CACHE = 'hm-d8';
const TIMEOUT_MS = 6000;

export const ARCHIVED_D8 = { classType: 'X8.2', peakTime: '2017-09-10T16:06Z' };

function apiKey(): string {
  const k = (import.meta as any).env?.VITE_NASA_API_KEY as string | undefined;
  return k && k.trim() ? k.trim() : 'DEMO_KEY';
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function archived(error: string): D8Result {
  return {
    source: 'ARCHIVED',
    classType: ARCHIVED_D8.classType,
    peakTime: ARCHIVED_D8.peakTime,
    flrID: null,
    fetchedAt: new Date().toISOString(),
    cubes: shieldLineForClass(ARCHIVED_D8.classType),
    error,
  };
}

/** Picks the strongest flare from a DONKI FLR response. Exported for tests. */
export function strongest(list: Array<{ classType?: string; peakTime?: string; flrID?: string }>): { classType: string | null; peakTime: string | null; flrID: string | null } {
  let best: (typeof list)[number] | null = null;
  for (const f of list) if (f.classType && (!best || flareRank(f.classType) > flareRank(best.classType!))) best = f;
  return { classType: best?.classType ?? null, peakTime: best?.peakTime ?? null, flrID: best?.flrID ?? null };
}

let inflight: Promise<D8Result> | null = null;

export function fetchD8(): Promise<D8Result> {
  try {
    const hit = sessionStorage.getItem(CACHE);
    if (hit) return Promise.resolve(JSON.parse(hit) as D8Result);
  } catch {
    /* storage unavailable */
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 86400_000);
    const url = `https://api.nasa.gov/DONKI/FLR?startDate=${ymd(start)}&endDate=${ymd(end)}&api_key=${encodeURIComponent(apiKey())}`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let result: D8Result;
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const list = text.trim() ? JSON.parse(text) : [];
      if (!Array.isArray(list)) throw new Error('unexpected response');
      const s = strongest(list);
      result = { source: 'LIVE', ...s, fetchedAt: new Date().toISOString(), cubes: shieldLineForClass(s.classType) };
    } catch (e: any) {
      result = archived(e?.name === 'AbortError' ? 'timed out after 6 s' : String(e?.message ?? e));
    } finally {
      clearTimeout(timer);
    }
    try {
      sessionStorage.setItem(CACHE, JSON.stringify(result));
    } catch {
      /* storage unavailable */
    }
    return result;
  })();
  return inflight;
}

export function fetchedLabel(r: D8Result): string {
  const t = new Date(r.fetchedAt);
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return `${r.source} · ${ymd(t)} ${hh}:${mm} UTC`;
}
