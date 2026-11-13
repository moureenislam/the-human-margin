// Title, pause, settings, save/load, credits, Data Journal, line log and ending panels.
import { bgImage } from './assets';
import { audio } from '../engine/audio';
import { saveSettings, settings } from '../engine/settings';
import { readSave, SLOTS, type SlotId } from '../engine/save';
import { pushKeys } from './input';
import { CARDS, openLink } from './cards';
import { REFS } from './hud';
import type { BacklogEntry } from './dialogue';
import type { StageRefs } from './stage';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string, parent?: HTMLElement) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

function btn(label: string, onClick: () => void, parent: HTMLElement, cls = '') {
  const b = el('button', 'px-btn ' + cls, label, parent);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    audio.sfx('blip');
    onClick();
  });
  return b;
}

/** Arrow keys move focus between the buttons of a menu; Enter/Space press the focused one. */
function menuKeys(root: HTMLElement, onEsc?: () => void): () => void {
  return pushKeys((e) => {
    const items = [...root.querySelectorAll<HTMLElement>('button:not([disabled]), input')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' && !(document.activeElement instanceof HTMLInputElement)) {
      items[(i + 1) % items.length]?.focus();
      return true;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' && !(document.activeElement instanceof HTMLInputElement)) {
      items[(i - 1 + items.length) % items.length]?.focus();
      return true;
    }
    if (e.key === 'Escape') {
      onEsc?.();
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement instanceof HTMLButtonElement && root.contains(document.activeElement)) {
        document.activeElement.click();
        return true;
      }
      return true;
    }
    // Swallow other keys so the game underneath doesn't react.
    return e.key.length === 1;
  });
}

const DATASETS = [
  { label: "See today's Sun", source: 'NASA DONKI', url: 'https://ccmc.gsfc.nasa.gov/tools/DONKI' },
  { label: 'See the plant experiments', source: 'NASA OSDR', url: 'https://osdr.nasa.gov' },
  { label: 'See Shackleton from orbit', source: 'NASA LRO / LROC', url: 'https://www.lroc.asu.edu/images/1105' },
  { label: 'Read the air and radiation limits', source: 'NASA OCHMO technical briefs', url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
];

export class Menus {
  constructor(private r: StageRefs) {}

  private open(build: (root: HTMLElement, close: () => void) => void, onEsc: 'close' | (() => void) = 'close'): Promise<void> {
    return new Promise((resolve) => {
      const layer = this.r.layer.menus;
      const root = el('div', 'layer', undefined, layer);
      el('div', 'menu-dim', undefined, root);
      const close = () => {
        unkeys();
        root.remove();
        resolve();
      };
      build(root, close);
      const unkeys = menuKeys(root, onEsc === 'close' ? close : onEsc);
      setTimeout(() => root.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true }), 0);
    });
  }

  title(hasContinue: boolean, missingArt: number): Promise<'new' | 'continue' | 'load' | 'settings' | 'credits'> {
    return new Promise((resolve) => {
      const layer = this.r.layer.menus;
      const root = el('div', 'title-screen', undefined, layer);
      root.appendChild(bgImage('BG09'));
      el('div', 'logo', 'THE HUMAN MARGIN', root);
      el('div', 'sub', 'Every number that can hurt you comes from real NASA data.', root);
      const b = el('div', 'buttons', undefined, root);
      const pick = (v: 'new' | 'continue' | 'load' | 'settings' | 'credits') => {
        unkeys();
        root.remove();
        resolve(v);
      };
      btn('New game', () => pick('new'), b, 'primary');
      const c = btn('Continue', () => pick('continue'), b);
      c.disabled = !hasContinue;
      btn('Load', () => pick('load'), b);
      btn('Settings', () => pick('settings'), b);
      btn('Data sources and credits', () => pick('credits'), b);
      el(
        'div',
        'note',
        missingArt ? `NASA Space Apps 2026 · ${missingArt} art files missing: drawn placeholders shown (see README)` : 'NASA Space Apps 2026',
        root,
      );
      const unkeys = menuKeys(root);
      setTimeout(() => (b.firstElementChild as HTMLElement)?.focus({ preventScroll: true }), 0);
    });
  }

  pause(): Promise<'resume' | 'save' | 'load' | 'journal' | 'log' | 'settings' | 'title'> {
    return new Promise((resolve) => {
      let result: any = 'resume';
      this.open((root, close) => {
        const m = el('div', 'menu px solid', undefined, root);
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-label', 'Paused');
        el('h2', '', 'PAUSED', m);
        const go = (v: typeof result) => () => {
          result = v;
          close();
        };
        btn('Resume', go('resume'), m, 'primary');
        btn('Save', go('save'), m);
        btn('Load', go('load'), m);
        btn('Data Journal', go('journal'), m);
        btn('Line log (L)', go('log'), m);
        btn('Settings', go('settings'), m);
        btn('Quit to title', go('title'), m);
      }).then(() => resolve(result));
    });
  }

  settings(onChange: () => void): Promise<void> {
    return this.open((root, close) => {
      const m = el('div', 'menu px solid', undefined, root);
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-label', 'Settings');
      el('h2', '', 'SETTINGS', m);
      const seg = (label: string, opts: [string, () => boolean, () => void][]) => {
        const row = el('div', 'row', undefined, m);
        el('span', 'label', label, row);
        const s = el('div', 'seg', undefined, row);
        const bs = opts.map(([t, on, set]) => {
          const b = btn(t, () => {
            set();
            saveSettings(settings);
            onChange();
            bs.forEach((x, i) => x.classList.toggle('on', opts[i][1]()));
          }, s, 'small');
          b.classList.toggle('on', on());
          return b;
        });
      };
      seg('Text speed', ([20, 40, 80, 0] as const).map((v) => [v === 0 ? 'Instant' : String(v), () => settings.textSpeed === v, () => (settings.textSpeed = v)] as [string, () => boolean, () => void]));
      const vr = el('div', 'row', undefined, m);
      el('span', 'label', 'Volume', vr);
      const range = el('input', '', undefined, vr) as HTMLInputElement;
      range.type = 'range';
      range.min = '0';
      range.max = '100';
      range.value = String(Math.round(settings.volume * 100));
      range.setAttribute('aria-label', 'Volume');
      range.addEventListener('input', () => {
        settings.volume = Number(range.value) / 100;
        saveSettings(settings);
        onChange();
      });
      seg('Sound', [
        ['On', () => !settings.muted, () => (settings.muted = false)],
        ['Mute', () => settings.muted, () => (settings.muted = true)],
      ]);
      seg('Reduce motion', [
        ['Off', () => !settings.reduceMotion, () => (settings.reduceMotion = false)],
        ['On', () => settings.reduceMotion, () => (settings.reduceMotion = true)],
      ]);
      el('div', 'muted', 'Keys: Space/Enter continue · 1–3 choose · Esc pause · L log · A auto · S skip seen lines', m).style.fontSize = '24px';
      btn('Back', close, m, 'primary');
    });
  }

  /** Save or load picker. Returns the chosen slot, or null. */
  slots(mode: 'save' | 'load'): Promise<SlotId | null> {
    return new Promise((resolve) => {
      let chosen: SlotId | null = null;
      this.open((root, close) => {
        const m = el('div', 'menu px solid', undefined, root);
        m.setAttribute('role', 'dialog');
        el('h2', '', mode === 'save' ? 'SAVE' : 'LOAD', m);
        for (const s of SLOTS) {
          if (mode === 'save' && s === 'auto') continue;
          const f = readSave(s);
          const b = btn('', () => {
            chosen = s;
            close();
          }, m, 'slot');
          el('span', '', s === 'auto' ? 'Autosave' : 'Slot ' + s, b);
          el('span', 'meta', f ? `${f.label} · ${new Date(f.when).toLocaleString()}` : 'Empty', b);
          if (mode === 'load' && !f) b.disabled = true;
        }
        btn('Back', close, m, 'primary');
      }).then(() => resolve(chosen));
    });
  }

  credits(): Promise<void> {
    return this.open((root, close) => {
      const m = el('div', 'menu px solid scroll', undefined, root);
      m.style.top = '60px';
      m.style.maxHeight = '960px';
      m.style.width = '1200px';
      m.style.left = '360px';
      el('h2', '', 'DATA SOURCES AND CREDITS', m);
      const p = (t: string) => (el('div', '', t, m).style.fontSize = '28px');
      p('Story: "Selene Ridge: Game Script (Lean Build)", adjusted for The Human Margin. Made for NASA Space Apps 2026.');
      p('Art: The Human Margin art team (backgrounds and character sprites).');
      p('Fonts: Pixelify Sans and Silkscreen, both under the SIL Open Font License (Google Fonts).');
      p('Sound: generated in the browser with Web Audio.');
      el('div', 'label gold', 'NASA open data', m);
      const links: [string, string][] = [
        ['NASA DONKI (space weather)', 'https://ccmc.gsfc.nasa.gov/tools/DONKI'],
        ['NASA OCHMO radiation protection brief', REFS.D2.url!],
        ['NASA OCHMO carbon dioxide brief', REFS.D3.url!],
        ['NASA OCHMO life support brief', 'https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf'],
        ['NASA lunar communications architecture', REFS.COMMS.url!],
        ['LROC: Shackleton lighting', 'https://www.lroc.asu.edu/images/1105'],
        ['NASA OSDR (Veggie)', 'https://osdr.nasa.gov'],
        ['US National Weather Service: space storm types', REFS.NWS.url!],
        ['May 2024 solar storms (encyclopedia)', 'https://en.wikipedia.org/wiki/May_2024_solar_storms'],
      ];
      for (const [t, u] of links) btn(t + ' ›', () => openLink(u), m, 'small');
      el('div', 'label gold', 'Design choices (not NASA data)', m);
      p('Cube counts, Shield and Air lines, storm strengths 300 and 200, route tile costs (lit 4%, shadow 8%), drill timing (10 s / 20 s, 7 s / 14 s fast), the drill sample window, the dust sweep thresholds (3–5 rows = half), and "Turn back now" costing 0 battery (guide P2). The limits behind them (250 mSv, 600 mSv, 3 mmHg) are NASA\'s.');
      btn('Back', close, m, 'primary');
    });
  }

  backlog(entries: BacklogEntry[]): Promise<void> {
    return this.open((root, close) => {
      const m = el('div', 'backlog px solid', undefined, root);
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-label', 'Line log');
      const bar = el('div', 'mg-title', undefined, m);
      el('div', 'label gold', 'LINE LOG', bar);
      const list = el('div', 'list scroll', undefined, m);
      for (const e of entries) {
        const d = el('div', 'entry', undefined, list);
        if (e.who) el('b', '', e.who, d);
        d.append(e.text);
      }
      const f = el('div', 'actions', undefined, m);
      f.style.padding = '16px';
      f.style.textAlign = 'center';
      btn('Close', close, f, 'primary small');
      setTimeout(() => (list.scrollTop = list.scrollHeight), 0);
      const unL = pushKeys((e) => {
        if (e.key === 'l' || e.key === 'L') {
          unL();
          close();
          return true;
        }
        return false;
      });
    });
  }

  /** Data Journal: every card seen, in order, with the four dataset buttons. */
  journal(ids: string[], actions: { label: string; value: string }[], closing: string | null): Promise<string> {
    return new Promise((resolve) => {
      let result = 'close';
      this.open((root, close) => {
        root.insertBefore(bgImage('BG09'), root.firstChild!.nextSibling);
        const m = el('div', 'journal px solid', undefined, root);
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-label', 'Data Journal');
        const bar = el('div', 'mg-title', undefined, m);
        el('div', 'label gold', 'DATA JOURNAL', bar);
        el('div', 'label muted', `${ids.length} card${ids.length === 1 ? '' : 's'} seen`, bar);
        const list = el('div', 'list scroll', undefined, m);
        if (!ids.length) el('div', 'muted', 'No cards yet.', list);
        for (const id of ids) {
          const c = CARDS[id];
          if (!c) continue;
          const item = el('div', 'jitem px solid ' + c.kind, undefined, list);
          if (c.kind === 'data') {
            el('div', 'h', `${id} · ${c.label}`, item);
            el('p', '', c.facts.join(' '), item);
            el('p', 'muted', `Game effect: ${c.effect}. Source: ${c.source}.`, item);
          } else {
            el('div', 'h', `${id} · ${c.mission}`, item);
            el('p', '', c.happened.join(' '), item);
            el('p', 'muted', `What changed: ${c.changed}.`, item);
          }
        }
        const links = el('div', 'links', undefined, m);
        for (const d of DATASETS) {
          const b = btn(d.label + ' ›', () => openLink(d.url), links, 'small');
          b.title = d.source;
        }
        if (closing) el('div', 'closing', closing, m);
        const act = el('div', 'actions', undefined, m);
        for (const a of actions)
          btn(a.label, () => {
            result = a.value;
            close();
          }, act, a === actions[0] ? 'primary' : '');
      }, actions.some((a) => a.value === 'close') ? 'close' : () => {}).then(() => resolve(result));
    });
  }

  /** End panel for Learning Endings (Rewind + question already shown). */
  endPanel(title: string, actions: { label: string; value: string }[]): Promise<string> {
    return new Promise((resolve) => {
      let result = actions[0].value;
      this.open((root, close) => {
        const m = el('div', 'menu px solid', undefined, root);
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-label', title);
        el('h2', '', title.toUpperCase(), m);
        for (const a of actions)
          btn(a.label, () => {
            result = a.value;
            close();
          }, m, a === actions[0] ? 'primary' : '');
      }, () => {}).then(() => resolve(result));
    });
  }

  confirm(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      let ok = false;
      this.open((root, close) => {
        const m = el('div', 'menu px solid', undefined, root);
        m.style.top = '300px';
        el('div', '', text, m);
        btn('Yes', () => {
          ok = true;
          close();
        }, m, 'primary');
        btn('No', close, m);
      }).then(() => resolve(ok));
    });
  }
}
