// Every ink tag the engine understands. Unknown tags throw in validation (the walker test),
// so a typo in the script fails the build instead of silently doing nothing.
import { isMinigameId } from '../minigames/ids';
import type { MinigameId } from '../minigames/types';

export type Slot = 'L' | 'C' | 'R';
export type Mood = 'happy' | 'curious' | 'worried' | 'end';
export type HudItem = 'POWER' | 'AIR' | 'SHIELD' | 'FOOD' | 'BATTERY' | 'SCIENCE';

export type Tag =
  | { k: 'scene'; id: string; title: string }
  | { k: 'chapter'; n: number; title: string }
  | { k: 'bg'; code: string }
  | { k: 'show'; slot: Slot; code: string }
  | { k: 'hide'; slot: Slot | 'all' }
  | { k: 'swap'; code: string }
  | { k: 'inset'; codes: string[] }
  | { k: 'hideinset' }
  | { k: 'call'; mood: Mood }
  | { k: 'card'; id: string }
  | { k: 'echo'; id: string }
  | { k: 'journal'; ids: string[] }
  | { k: 'ref'; id: string }
  | { k: 'ref_needed'; note: string }
  | { k: 'minigame'; id: MinigameId; params: Record<string, true> }
  | { k: 'hud'; mode: 'set' | 'add' | 'none'; items: HudItem[] }
  | { k: 'sfx'; name: string }
  | { k: 'ambient'; name: string | null }
  | { k: 'warn'; level: 'amber' | 'red' }
  | { k: 'zoom'; on: boolean }
  | { k: 'timer'; text: string | null }
  | { k: 'fetch_donki' }
  | { k: 'ending'; id: string; title: string }
  | { k: 'rewind'; scene: string }
  | { k: 'prop'; name: string }
  | { k: 'journal_screen' };

export interface ChoiceMeta {
  title?: string;
  fx?: string;
  echoTag?: { id: string; line: string };
  /** Power this button needs (parsed from "POWER −n" in fx). */
  powerNeed: number;
  flavour: boolean;
}

const HUD_ITEMS: HudItem[] = ['POWER', 'AIR', 'SHIELD', 'FOOD', 'BATTERY', 'SCIENCE'];
const SFX = ['chime', 'alarm', 'blip', 'static', 'tick', 'success', 'fail', 'thud'];
const AMBIENT = ['hum', 'fans', 'synth', 'drone', 'piano', 'theme', 'wind', 'tick', 'static'];

function splitKV(raw: string): [string, string] {
  const i = raw.indexOf(':');
  if (i < 0) return [raw.trim(), ''];
  return [raw.slice(0, i).trim(), raw.slice(i + 1).trim()];
}

export class TagError extends Error {}

/** Parses one line tag. Returns null for an empty tag (a dynamic tag whose condition was false). */
export function parseTag(raw: string): Tag | null {
  const s = raw.trim();
  if (!s) return null;
  const [key, val] = splitKV(s);
  const words = val.split(/\s+/).filter(Boolean);
  const fail = (why: string): never => {
    throw new TagError(`bad tag "# ${s}": ${why}`);
  };
  switch (key) {
    case 'scene': {
      if (!words[0]) fail('missing id');
      return { k: 'scene', id: words[0], title: words.slice(1).join(' ') };
    }
    case 'chapter':
      return { k: 'chapter', n: Number(words[0]), title: words.slice(1).join(' ') };
    case 'bg':
      if (!words[0]) fail('missing code');
      return { k: 'bg', code: words[0] };
    case 'show': {
      const slot = words[0] as Slot;
      if (!['L', 'C', 'R'].includes(slot) || !words[1]) fail('expected "show: L CODE"');
      return { k: 'show', slot, code: words[1] };
    }
    case 'hide': {
      const slot = words[0] as Slot | 'all';
      if (!['L', 'C', 'R', 'all'].includes(slot)) fail('expected L, C, R or all');
      return { k: 'hide', slot };
    }
    case 'swap':
      if (!words[0]) fail('missing code');
      return { k: 'swap', code: words[0] };
    case 'inset':
      if (!words.length) fail('missing code');
      return { k: 'inset', codes: words };
    case 'hideinset':
      return { k: 'hideinset' };
    case 'call': {
      const mood = words[0] as Mood;
      if (!['happy', 'curious', 'worried', 'end'].includes(mood)) fail('mood');
      return { k: 'call', mood };
    }
    case 'card':
    case 'echo':
      if (!words[0]) fail('missing id');
      return { k: key, id: words[0] };
    case 'journal':
      return { k: 'journal', ids: words };
    case 'ref':
      if (!words[0]) fail('missing id');
      return { k: 'ref', id: words[0] };
    case 'ref_needed':
      return { k: 'ref_needed', note: val };
    case 'minigame': {
      if (!isMinigameId(words[0])) fail('unknown minigame ' + words[0]);
      const params: Record<string, true> = {};
      for (const w of words.slice(1)) params[w] = true;
      return { k: 'minigame', id: words[0] as MinigameId, params };
    }
    case 'hud': {
      if (words[0] === 'none') return { k: 'hud', mode: 'none', items: [] };
      const add = words[0]?.startsWith('+');
      const items = words.map((w) => w.replace(/^\+/, '')) as HudItem[];
      for (const it of items) if (!HUD_ITEMS.includes(it)) fail('unknown HUD item ' + it);
      return { k: 'hud', mode: add ? 'add' : 'set', items };
    }
    case 'sfx':
      if (!SFX.includes(words[0])) fail('unknown sfx');
      return { k: 'sfx', name: words[0] };
    case 'ambient':
      if (words[0] !== 'none' && !AMBIENT.includes(words[0])) fail('unknown ambient');
      return { k: 'ambient', name: words[0] === 'none' ? null : words[0] };
    case 'warn':
      if (words[0] !== 'amber' && words[0] !== 'red') fail('amber or red');
      return { k: 'warn', level: words[0] as 'amber' | 'red' };
    case 'zoom':
      return { k: 'zoom', on: words[0] !== 'off' };
    case 'timer':
      return { k: 'timer', text: words[0] === 'off' ? null : val };
    case 'fetch_donki':
      return { k: 'fetch_donki' };
    case 'ending':
      return { k: 'ending', id: words[0], title: words.slice(1).join(' ') };
    case 'rewind':
      return { k: 'rewind', scene: words[0] };
    case 'prop':
      return { k: 'prop', name: val };
    case 'journal_screen':
      return { k: 'journal_screen' };
  }
  return fail('unknown tag');
}

/** Parses the tags on a choice: title, fx (effect text), echo_tag ("ML1 one-line text"), flavour. */
export function parseChoiceTags(tags: string[] | null | undefined): ChoiceMeta {
  const meta: ChoiceMeta = { powerNeed: 0, flavour: false };
  for (const raw of tags ?? []) {
    const [key, val] = splitKV(raw);
    if (key === 'title') meta.title = val;
    else if (key === 'fx') meta.fx = val;
    else if (key === 'echo_tag') {
      const sp = val.indexOf(' ');
      meta.echoTag = { id: sp < 0 ? val : val.slice(0, sp), line: sp < 0 ? '' : val.slice(sp + 1) };
    } else if (key === 'flavour') meta.flavour = true;
    else if (key) throw new TagError(`unknown choice tag "# ${raw}"`);
  }
  if (meta.title === 'Last Words') meta.flavour = true;
  const m = meta.fx ? /POWER\s*[−-]\s*(\d+)/.exec(meta.fx) : null;
  if (m) meta.powerNeed = Number(m[1]);
  return meta;
}
