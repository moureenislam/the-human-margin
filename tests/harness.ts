// Shared test helpers: compile the real story once, and run it headless.
import { resolve } from 'node:path';
import { Story } from 'inkjs/full';
import { compileInkFile } from '../scripts/compileInk';

let cached: string | null = null;
export function storyJson(): string {
  if (!cached) cached = compileInkFile(resolve(__dirname, '../story/main.ink'));
  return cached;
}

export function newStory(): any {
  return new Story(storyJson()) as any;
}

export { VAR_NAMES } from '../src/engine/vars';
import { VAR_NAMES } from '../src/engine/vars';

export function readVars(story: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const n of VAR_NAMES) out[n] = story.variablesState.$(n);
  return out;
}

export function setVars(story: any, vars: Record<string, any>) {
  for (const [k, v] of Object.entries(vars)) story.variablesState.$(k, v);
}

/** Jump to a knot with the given variables and return the knot of the first ending tag reached. */
export function runGate(gate: string, vars: Record<string, any>): string {
  const s = newStory();
  setVars(s, vars);
  s.ChoosePathString(gate);
  let guard = 0;
  while (guard++ < 400) {
    if (s.canContinue) {
      s.Continue();
      for (const t of s.currentTags ?? []) {
        const m = /^(scene|ending):\s*(\S+)/.exec(t);
        if (m && m[1] === 'ending') return m[2];
        if (m && m[1] === 'scene') return 'scene ' + m[2];
      }
    } else if (s.currentChoices.length) {
      s.ChooseChoiceIndex(0);
    } else break;
  }
  return 'none';
}
