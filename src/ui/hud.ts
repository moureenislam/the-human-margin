// HUD chips (top left) and the data reference chip (top right, guide section 5).
// Colour is never the only signal: every amber/red chip also shows a word.
import type { HudItem } from '../engine/tags';
import { co2mmHg, LIMITS } from '../engine/rules';
import refs from '../data/refs.json';
import cards from '../data/cards.json';
import type { StageRefs } from './stage';

type Vars = Record<string, any>;
type RefInfo = { label: string; source: string; url?: string; note?: string };
export const REFS = refs as Record<string, RefInfo>;

export class RefChip {
  private el: HTMLButtonElement;
  private current: string | null = null;
  private lineRef: { id: string; extra?: string } | null = null;
  private hoverRef: { id: string; extra?: string } | null = null;
  private pinned: { id: string; extra?: string } | null = null;
  onOpen: (id: string) => void = () => {};

  constructor(r: StageRefs) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'refchip px solid';
    this.el.style.display = 'none';
    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.current) this.onOpen(this.current);
    });
    r.layer.hud.appendChild(this.el);
  }

  /** The ref of the line on screen (until the next line). */
  setLine(id: string | null, extra?: string) {
    this.lineRef = id ? { id, extra } : null;
    this.draw();
  }
  /** A ref that stays while something is open (a card, a minigame). Wins over the line ref. */
  pin(id: string | null, extra?: string) {
    this.pinned = id ? { id, extra } : null;
    this.draw();
  }
  hover(id: string | null) {
    this.hoverRef = id ? { id } : null;
    this.draw();
  }

  private draw() {
    const r = this.pinned ?? this.hoverRef ?? this.lineRef;
    if (!r || !REFS[r.id]) {
      this.current = null;
      this.el.style.display = 'none';
      return;
    }
    const info = REFS[r.id];
    this.current = r.id;
    const isEcho = r.id.startsWith('ML');
    const text = `REF ${r.id} · ${isEcho ? info.label : info.source}${r.extra ? ' · ' + r.extra : ''}`;
    this.el.className = 'refchip px solid' + (isEcho ? ' echo' : '');
    this.el.replaceChildren();
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = text;
    this.el.append(t, ' ›');
    this.el.title = `${text}. ${info.label}. Tap to open.`;
    this.el.setAttribute('aria-label', `Data reference ${r.id}: ${info.source}, ${info.label}. Open.`);
    this.el.style.display = '';
  }
}

export class Hud {
  private wrap: HTMLElement;
  private chips = new Map<HudItem, HTMLElement>();
  private last: Record<string, number> = {};

  constructor(r: StageRefs, private ref: RefChip) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'hud';
    this.wrap.setAttribute('aria-label', 'Outpost status');
    r.layer.hud.appendChild(this.wrap);
  }

  update(items: HudItem[], v: Vars) {
    const show = new Set(items);
    if (items.length && Number(v.SCIENCE) > 0) show.add('SCIENCE');
    for (const [k, el] of this.chips) if (!show.has(k)) {
      el.remove();
      this.chips.delete(k);
    }
    const order: HudItem[] = ['POWER', 'AIR', 'SHIELD', 'FOOD', 'BATTERY', 'SCIENCE'];
    for (const item of order) {
      if (!show.has(item)) continue;
      let el = this.chips.get(item);
      if (!el) {
        el = document.createElement('div');
        el.className = 'chip px solid';
        el.tabIndex = 0;
        const refId = this.refFor(item, v);
        el.addEventListener('mouseenter', () => this.ref.hover(this.refFor(item, v)));
        el.addEventListener('mouseleave', () => this.ref.hover(null));
        el.addEventListener('focus', () => this.ref.hover(this.refFor(item, v)));
        el.addEventListener('blur', () => this.ref.hover(null));
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.ref.hover(this.refFor(item, v) ?? refId);
        });
        this.chips.set(item, el);
      }
      this.wrap.appendChild(el); // keeps the order
      this.draw(item, el, v);
    }
  }

  private refFor(item: HudItem, v: Vars): string | null {
    if (item === 'AIR') return 'D3';
    if (item === 'BATTERY') return 'D5';
    if (item === 'POWER' && Number(v.CHAPTER) === 4) return 'D6';
    if (item === 'SHIELD') return 'D2';
    return null;
  }

  private draw(item: HudItem, el: HTMLElement, v: Vars) {
    let state: '' | 'amber' | 'red' = '';
    let word = '';
    let tip = '';
    const n = Number(v[item]);
    el.replaceChildren();
    const name = document.createElement('span');
    name.textContent = item;
    el.appendChild(name);
    if (item === 'POWER') {
      const max = Number(v.CHAPTER) === 4 ? 7 : Math.max(10, n);
      const cubes = document.createElement('span');
      cubes.className = 'cubes';
      for (let i = 0; i < max; i++) {
        const c = document.createElement('i');
        c.className = 'cube' + (i < n ? '' : ' off');
        cubes.appendChild(c);
      }
      el.appendChild(cubes);
      const val = document.createElement('span');
      val.className = 'v';
      val.textContent = `${n}/${max}`;
      el.appendChild(val);
      if (n === 0) [state, word] = ['red', 'EMPTY'];
      tip = `Power cubes left today: ${n}.` + (Number(v.CHAPTER) === 4 ? ' Dusty panels: refill 7 instead of 10 (card D6).' : '');
    } else {
      const val = document.createElement('span');
      val.className = 'v';
      if (item === 'AIR') {
        val.textContent = String(n);
        if (n < LIMITS.airRed) [state, word] = ['red', 'DANGER'];
        else if (n < LIMITS.airAmber) [state, word] = ['amber', 'HIGH CO2'];
        tip = `AIR ${n}: CO2 ${co2mmHg(n).toFixed(1)} mmHg. NASA's limit is 3 mmHg (AIR 40).`;
      } else if (item === 'SHIELD') {
        val.textContent = String(n);
        if (n < 25) [state, word] = ['amber', 'THIN'];
        tip = `Shield ${n}: a storm's dose is multiplied by ${(1 - n / 100).toFixed(2)}.`;
      } else if (item === 'FOOD') {
        val.textContent = `${n} DAYS`;
        // Guide P5: the FOOD chip warns before the Chapter 5 line of 3 days.
        if (n < LIMITS.foodLine) [state, word] = ['red', 'SHORT'];
        else if (n <= 4) [state, word] = ['amber', 'LOW'];
        tip = `Food: ${n} days. You need 3 or more to launch.`;
      } else if (item === 'BATTERY') {
        val.textContent = `${n}%`;
        if (n <= 50) [state, word] = ['red', 'TURN'];
        else if (n <= 60) [state, word] = ['amber', 'LINE'];
        tip = `Rover battery ${n}%. Turn back at 60%.`;
      } else if (item === 'SCIENCE') {
        val.textContent = String(n);
        tip = 'Science points (score only).';
      }
      el.appendChild(val);
    }
    if (word) {
      const w = document.createElement('span');
      w.className = 'word';
      w.textContent = word;
      el.appendChild(w);
    }
    el.className = 'chip px solid' + (state ? ' ' + state : '');
    const prev = this.last[item];
    if (prev !== undefined && prev !== n) {
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
    this.last[item] = n;
    el.title = tip;
    el.setAttribute('aria-label', `${item} ${el.textContent}. ${tip}`);
  }
}

export function cardRefLabel(id: string): string {
  const c = (cards as any)[id];
  return c?.label ?? c?.mission ?? id;
}
