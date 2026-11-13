// Story walker (guide 9.1): plays every path through the compiled story, with every choice
// (including amber and red reopenings), every minigame result, D8 as X / M / quiet / offline.
// Fails if a path errors or stalls, an ID is missing, an old name appears, or an ending can't be reached.
import { beforeAll, describe, expect, it } from 'vitest';
import { newStory, readVars, setVars } from './harness';
import { parseChoiceTags, parseTag, type Tag } from '../src/engine/tags';
import { parseLine } from '../src/engine/lines';
import { applyOutcome, possibleOutcomes } from '../src/engine/outcomes';
import cards from '../src/data/cards.json';
import refs from '../src/data/refs.json';
import assets from '../src/data/assets.json';

const OLD_NAMES = /Selene Ridge|Okonkwo|Herrera|Faleolo/;
// States are merged when they agree on every variable that can still change what happens.
// Score-only variables never matter; working variables stop mattering once their chapter is over
// (each is either overwritten before it's read again, or never read again). Trust only picks the
// Ridge Dawn closing speaker, which is checked separately (rules test), so it is merged here too.
const ALWAYS_DEAD = ['SCIENCE', 'CAREER', 'TRUST_AMARA', 'TRUST_LUCIA', 'TRUST_SIONE', 'LAST_WORDS', 'D8_CLASS', 'D8_SOURCE', 'D8_FETCHED'];
const DEAD_FROM_CHAPTER: Record<number, string[]> = {
  2: ['DOSE', 'DRILL', 'SHIELD_AT_STORM'],
  3: ['SWAP_TIME', 'SWAP_OK', 'SWAP_FAILED', 'CHOSE_C', 'PICKED_ML3'],
  4: ['OUTBOUND_COST', 'SHADOW_TILES', 'SAMPLE', 'DRILL_LATE', 'BATTERY'],
  5: ['TRIAGE_WRONG', 'OUTSIDE', 'LAST_PICK', 'PICKED_ML6', 'DOSE', 'DRILL', 'SHIELD', 'AIR', 'HARVEST'],
};
function deadVars(chapter: number): Set<string> {
  const out = new Set(ALWAYS_DEAD);
  for (let c = 2; c <= chapter; c++) for (const v of DEAD_FROM_CHAPTER[c] ?? []) out.add(v);
  return out;
}

interface Result {
  endings: Map<string, number>;
  states: number;
  errors: string[];
  closingSpeakers: Set<string>;
  cardsSeen: Set<string>;
  scenes: Set<string>;
  sample: Map<string, string[]>; // ending → one example trail
}

function validateTag(t: Tag, where: string, errors: string[]) {
  const bad = (m: string) => errors.push(`${where}: ${m}`);
  switch (t.k) {
    case 'bg':
      if (!(t.code in assets.bg)) bad('unknown background ' + t.code);
      break;
    case 'show':
    case 'swap':
      if (!(t.code in assets.sprites)) bad('unknown sprite ' + t.code);
      break;
    case 'inset':
      for (const c of t.codes) if (!(c in assets.sprites)) bad('unknown inset sprite ' + c);
      break;
    case 'card':
    case 'echo':
      if (!(t.id in cards)) bad('unknown card ' + t.id);
      else if ((cards as any)[t.id].kind !== (t.k === 'card' ? 'data' : 'echo')) bad(`${t.k} tag on ${t.id}`);
      break;
    case 'journal':
      for (const id of t.ids) if (!(id in cards)) bad('unknown journal card ' + id);
      break;
    case 'ref':
      if (!(t.id in refs)) bad('unknown ref ' + t.id);
      break;
  }
}

function walk(): Result {
  const story = newStory();
  const res: Result = { endings: new Map(), states: 0, errors: [], closingSpeakers: new Set(), cardsSeen: new Set(), scenes: new Set(), sample: new Map() };
  const seen = new Set<string>();
  type Node = { state: string; trail: string[]; ending: string | null };
  const stack: Node[] = [{ state: story.state.ToJson(), trail: [], ending: null }];

  const keyOf = (prefix: string) => {
    const v = readVars(story);
    for (const k of deadVars(Number(v.CHAPTER))) delete v[k];
    return prefix + '|' + JSON.stringify(v);
  };

  while (stack.length) {
    const node = stack.pop()!;
    story.state.LoadJson(node.state);
    let ending = node.ending;
    const trail = node.trail;
    let lines = 0;
    let branched = false;

    while (!branched) {
      if (story.canContinue) {
        let text: string;
        try {
          text = story.Continue();
        } catch (e: any) {
          res.errors.push(`ink error after ${trail.join(' > ')}: ${e.message}`);
          branched = true;
          break;
        }
        if (++lines > 2000) {
          res.errors.push('stall (2000 lines without a branch) after ' + trail.join(' > '));
          branched = true;
          break;
        }
        const where = `[${trail.slice(-3).join(' > ')}] "${text.trim().slice(0, 50)}"`;
        if (OLD_NAMES.test(text)) res.errors.push('old name in ' + where);
        try {
          const line = parseLine(text);
          if (line && ending === 'dawn' && line.speaker && line.vo && /^(We read|We took|Let's come)/.test(line.text)) res.closingSpeakers.add(line.speaker);
        } catch (e: any) {
          res.errors.push(e.message + ' at ' + where);
        }
        let minigame: Extract<Tag, { k: 'minigame' }> | null = null;
        let fetch = false;
        for (const raw of story.currentTags ?? []) {
          if (OLD_NAMES.test(raw)) res.errors.push('old name in tag ' + raw);
          let t: Tag | null;
          try {
            t = parseTag(raw);
          } catch (e: any) {
            res.errors.push(e.message + ' at ' + where);
            continue;
          }
          if (!t) continue;
          validateTag(t, where, res.errors);
          if (t.k === 'card' || t.k === 'echo') res.cardsSeen.add(t.id);
          if (t.k === 'scene') res.scenes.add(t.id);
          if (t.k === 'ending') ending = t.id;
          if (t.k === 'minigame') minigame = t;
          if (t.k === 'fetch_donki') fetch = true;
        }
        if (fetch) {
          // D8 live: X-class (3), M-class (2), quiet (1); offline uses the archived X8.2 card (3).
          const after = story.state.ToJson();
          for (const [label, line] of [['X', 3], ['M', 2], ['quiet', 1], ['offline', 3]] as const) {
            story.state.LoadJson(after);
            setVars(story, { SHIELD_LINE: line });
            const key = keyOf('fetch' + label);
            if (seen.has(key)) continue;
            seen.add(key);
            stack.push({ state: story.state.ToJson(), trail: [...trail, 'D8:' + label], ending });
          }
          branched = true;
          break;
        }
        if (minigame) {
          const after = story.state.ToJson();
          const vars = readVars(story);
          for (const o of possibleOutcomes(minigame.id, vars)) {
            story.state.LoadJson(after);
            setVars(story, applyOutcome(minigame.id, o as any, vars));
            const key = keyOf('mg:' + minigame.id + ':' + text);
            if (seen.has(key)) continue;
            seen.add(key);
            stack.push({ state: story.state.ToJson(), trail: [...trail, `${minigame.id}=${JSON.stringify(o)}`], ending });
          }
          branched = true;
          break;
        }
      } else if (story.currentChoices.length) {
        const at = story.state.ToJson();
        const power = Number(story.variablesState.$('POWER'));
        const choices = story.currentChoices as any[];
        let anyEnabled = false;
        for (let i = 0; i < choices.length; i++) {
          let meta;
          try {
            meta = parseChoiceTags(choices[i].tags);
          } catch (e: any) {
            res.errors.push(e.message);
            continue;
          }
          if (OLD_NAMES.test(choices[i].text)) res.errors.push('old name in choice ' + choices[i].text);
          if (!meta.fx) res.errors.push(`choice without cost line (core rule 1): ${choices[i].text}`);
          if (meta.echoTag && !(meta.echoTag.id in cards)) res.errors.push('unknown echo tag ' + meta.echoTag.id);
          if (meta.powerNeed > power) continue; // disabled: "not enough Power"
          anyEnabled = true;
          story.state.LoadJson(at);
          story.ChooseChoiceIndex(i);
          const key = keyOf('choice:' + choices.map((c) => c.text).join('/') + ':' + i);
          if (seen.has(key)) continue;
          seen.add(key);
          stack.push({ state: story.state.ToJson(), trail: [...trail, choices[i].text], ending });
        }
        if (!anyEnabled) res.errors.push('no affordable choice after ' + trail.join(' > '));
        branched = true;
      } else {
        // End of story.
        if (!ending) res.errors.push('story ended without an ending tag after ' + trail.join(' > '));
        else {
          res.endings.set(ending, (res.endings.get(ending) ?? 0) + 1);
          if (!res.sample.has(ending)) res.sample.set(ending, trail);
        }
        branched = true;
      }
    }
    res.states++;
    if (res.states % 20000 === 0) process.stderr.write(`walker: ${res.states} states, stack ${stack.length}
`);
  }
  return res;
}

describe('story walker', () => {
  let res: Result;
  beforeAll(() => {
    res = walk();
  });

  it('plays every path without errors', () => {
    expect(res.errors.slice(0, 20)).toEqual([]);
  });

  it('reaches the endings the team decided should be reachable', () => {
    const reached = [...res.endings.keys()].sort();
    // Storm Return is reachable through Chapter 5 (Shield below the D8 line). Chapters 1 and 4 can't
    // produce it with the doc's numbers (guide P1 and P3); their gate rows stay as safety nets.
    expect(reached).toEqual(['LE1', 'LE2', 'LE3', 'LE4', 'LE5', 'dark', 'dawn', 'storm'].sort());
  });

  it('shows every data card and History Echo card somewhere', () => {
    const all = Object.keys(cards).sort();
    expect([...res.cardsSeen].sort()).toEqual(all);
  });

  it('visits every scene', () => {
    for (const s of ['P.1', '1.1', '1.2', '1.3', '1.4', '2.1', '2.2', '2.3', '2.4', '3.1', '3.2', '3.3', '4.1', '4.2', '4.3', '5.1', '5.2', '5.3', '5.4'])
      expect(res.scenes.has(s), s).toBe(true);
  });

  it('reports coverage', () => {
    console.log(`walker: ${res.states} states; endings`, Object.fromEntries(res.endings));
    for (const [e, t] of res.sample) console.log(`  ${e}: ${t.join(' > ')}`);
    expect(res.states).toBeGreaterThan(100);
  });
});
