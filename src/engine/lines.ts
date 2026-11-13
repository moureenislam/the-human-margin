// Parses a line of ink output into something the dialogue box can show.
export type LineKind = 'speech' | 'narration' | 'system' | 'title' | 'fade' | 'lesson' | 'question' | 'debrief';

export interface Line {
  kind: LineKind;
  speaker?: string; // AMARA, LUCIA, SIONE, MIMI, YOU, GROUND, NARRATOR
  vo?: boolean;
  radio?: boolean;
  direction?: string; // stage direction from "(…)", shown in italics before the text
  text: string;
}

export const SPEAKERS = ['AMARA', 'LUCIA', 'SIONE', 'MIMI', 'YOU', 'GROUND', 'NARRATOR'];
const SPECIAL: Record<string, LineKind> = {
  SYSTEM: 'system',
  TITLE: 'title',
  FADE: 'fade',
  LESSON: 'lesson',
  QUESTION: 'question',
  DEBRIEF: 'debrief',
};

const LINE_RE = /^([A-Z]+)(?: \(([^)]*)\))?: (.*)$/s;

/** Reaction lines are written "like this" in the script table; the quotes are formatting, not speech. */
function stripQuotes(t: string): string {
  if (t.startsWith('"') && t.endsWith('"') && (t.match(/"/g) ?? []).length === 2) return t.slice(1, -1);
  return t;
}

export class LineError extends Error {}

export function parseLine(raw: string): Line | null {
  const text = raw.trim();
  if (!text) return null;
  const m = LINE_RE.exec(text);
  if (!m) {
    if (text.startsWith('(') && text.endsWith(')')) return { kind: 'narration', text: text.slice(1, -1) };
    throw new LineError(`line has no speaker: "${text}"`);
  }
  const [, who, paren, body] = m;
  if (SPECIAL[who]) return { kind: SPECIAL[who], text: stripQuotes(body) };
  if (!SPEAKERS.includes(who)) throw new LineError(`unknown speaker ${who} in "${text}"`);
  const line: Line = { kind: 'speech', speaker: who, text: stripQuotes(body) };
  if (paren) {
    if (paren === 'V.O.') line.vo = true;
    else if (/^radio\b/.test(paren)) {
      line.radio = true;
      if (paren !== 'radio') line.direction = paren.replace(/^radio\s*/, '');
    } else line.direction = paren;
  }
  return line;
}
