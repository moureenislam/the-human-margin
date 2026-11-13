// Player settings, kept in localStorage. Every access is guarded: storage can be blocked.
export interface Settings {
  textSpeed: 20 | 40 | 80 | 0; // characters a second; 0 = instant
  volume: number; // 0..1
  muted: boolean;
  reduceMotion: boolean;
  autoDelay: number; // ms after a line finishes, in auto-advance
}

const KEY = 'hm-settings';
const DEFAULTS: Settings = {
  textSpeed: 40,
  volume: 0.6,
  muted: false,
  reduceMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  autoDelay: 1400,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export const settings: Settings = loadSettings();
