// Two card templates (data and History Echo), plus the source note for NWS / COMMS,
// the Learning Ending lesson and question cards, and full-screen title / fade cards.
import cards from '../data/cards.json';
import { bgImage } from './assets';
import { audio } from '../engine/audio';
import type { D8Result } from '../engine/donki';
import { fetchedLabel } from '../engine/donki';
import { pushKeys } from './input';
import { REFS } from './hud';
import type { StageRefs } from './stage';

type DataCard = { kind: 'data'; label: string; facts: string[]; effect: string; source: string; activity?: string };
type EchoCard = { kind: 'echo'; mission: string; happened: string[]; changed: string };
export const CARDS = cards as unknown as Record<string, DataCard | EchoCard>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string, parent?: HTMLElement) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export function openLink(url: string) {
  window.open(url, '_blank', 'noopener');
}

/** Generic modal card: resolves on OK, Enter, Space or Esc. */
function modal(r: StageRefs, build: (card: HTMLElement) => void, cls: string, label: string): Promise<void> {
  return new Promise((resolve) => {
    const layer = r.layer.cards;
    const dim = el('div', 'card-dim', undefined, layer);
    const card = el('div', 'card px solid ' + cls, undefined, layer);
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', label);
    build(card);
    const foot = card.querySelector('.foot') ?? el('div', 'foot', undefined, card);
    const ok = el('button', 'px-btn primary small', 'OK', foot as HTMLElement);
    ok.type = 'button';
    const close = () => {
      unkeys();
      dim.remove();
      card.remove();
      audio.sfx('blip');
      resolve();
    };
    ok.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    dim.addEventListener('click', (e) => e.stopPropagation());
    const unkeys = pushKeys((e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        if (!e.repeat) close();
        return true;
      }
      return e.key !== 'Tab'; // modal: nothing underneath reacts
    });
    setTimeout(() => ok.focus({ preventScroll: true }), 0);
  });
}

export function showCard(r: StageRefs, id: string, d8?: D8Result | null): Promise<void> {
  const c = CARDS[id];
  if (!c) return Promise.resolve();
  audio.sfx('chime');
  if (c.kind === 'data') {
    let label = c.label;
    if (id === 'D8' && d8) label = d8.source === 'LIVE' ? 'SPACE WEATHER · LIVE' : 'SPACE WEATHER · ARCHIVED';
    return modal(
      r,
      (card) => {
        el('div', 'bar', `${id} · ${label}`, card);
        const content = el('div', 'content scroll', undefined, card);
        for (const f of c.facts) el('div', 'fact', f, content);
        if (id === 'D8' && d8) {
          const live =
            d8.source === 'LIVE'
              ? d8.classType
                ? `Today: strongest flare of the last 7 days is ${d8.classType}${d8.peakTime ? `, peak ${d8.peakTime.replace('T', ' ').replace('Z', ' UTC')}` : ''}.`
                : 'Today: no flares listed in the last 7 days. A quiet week.'
              : `Offline: showing the archived X8.2 flare of 10 Sept 2017.`;
          el('div', 'live', live, content);
        }
        el('div', 'rule', undefined, content);
        el('div', 'eff-label', 'GAME EFFECT', content);
        let eff = c.effect;
        if (id === 'D8' && d8) eff += `. Tonight: Shield needs ${d8.cubes} cube${d8.cubes > 1 ? 's' : ''}.`;
        el('div', 'eff', eff, content);
        const foot = el('div', 'foot', undefined, card);
        const src = el('div', 'small', `Source: ${c.source}`, foot);
        src.style.flex = '1';
        if (c.activity) el('div', 'small', c.activity, src).style.marginTop = '4px';
        if (id === 'D8' && d8) el('div', 'small', `${fetchedLabel(d8)}${d8.flrID ? ' · ' + d8.flrID : ''}${d8.error ? ' · live call failed: ' + d8.error : ''}`, src);
      },
      'data',
      `Data card ${id}: ${label}`,
    );
  }
  return modal(
    r,
    (card) => {
      el('div', 'bar', `${id} · HISTORY ECHO · ${c.mission.toUpperCase()}`, card);
      const content = el('div', 'content scroll', undefined, card);
      for (const s of c.happened) el('div', 'fact', s, content);
      el('div', 'rule', undefined, content);
      el('div', 'eff-label', 'WHAT CHANGED', content);
      el('div', 'eff', c.changed, content);
      el('div', 'foot', undefined, card).appendChild(el('div', 'small', 'Source: History Echo (the team’s astronaut-mistakes list)'));
    },
    'echo',
    `History Echo ${id}: ${c.mission}`,
  );
}

/** NWS and COMMS have no card: open a short note with the link from the doc's source list. */
export function showNote(r: StageRefs, id: string): Promise<void> {
  const info = REFS[id];
  return modal(
    r,
    (card) => {
      el('div', 'bar', `${id} · ${info.label.toUpperCase()}`, card);
      const content = el('div', 'content', undefined, card);
      if (info.note) el('div', 'fact', info.note, content);
      el('div', 'small', `Source: ${info.source}`, content);
      const foot = el('div', 'foot', undefined, card);
      if (info.url) {
        const b = el('button', 'px-btn small', 'Open source ›', foot);
        b.type = 'button';
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          openLink(info.url!);
        });
      }
    },
    'data',
    `${info.label}: ${info.source}`,
  );
}

const PROP_ICON: Record<string, string> = {
  Figurine: 'figurine',
  'Small gauge panel': 'gauge',
  'Vial of ice': 'vial',
  'Jar of gray dust': 'jar',
  'Checklist card, one line circled': 'checklist',
};

/** Learning Ending cards: the prop's name and a small pixel icon in the header. */
export function showLessonCard(r: StageRefs, kind: 'lesson' | 'question', text: string, prop: string | null): Promise<void> {
  return modal(
    r,
    (card) => {
      const bar = el('div', 'bar', undefined, card);
      el('span', 'prop-icon ' + (PROP_ICON[prop ?? ''] ?? ''), undefined, bar);
      bar.append(`${kind === 'lesson' ? 'LESSON CARD' : 'QUESTION'}${prop ? ' · ' + prop.toUpperCase() : ''}`);
      const content = el('div', 'content', undefined, card);
      content.style.justifyContent = 'center';
      el('div', 'big', text, content);
    },
    'lesson',
    kind === 'lesson' ? 'Lesson card' : 'Question',
  );
}

/** Title card and FADE CARD: full screen over BG09 Orbit. */
export function showFullCard(r: StageRefs, text: string): Promise<void> {
  return new Promise((resolve) => {
    const layer = r.layer.overlay;
    const wrap = el('div', 'fullcard', undefined, layer);
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', text);
    wrap.appendChild(bgImage('BG09'));
    el('div', 'shade', undefined, wrap);
    el('div', 'msg px solid', text, wrap);
    el('div', 'hint', 'Click or press Space to continue', wrap);
    r.live.textContent = text;
    const done = () => {
      unkeys();
      wrap.remove();
      resolve();
    };
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      done();
    });
    const unkeys = pushKeys((e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (!e.repeat) done();
        return true;
      }
      return e.key !== 'Escape';
    });
  });
}
