// Dialogue box: types at the chosen speed, first input finishes the line, the next continues.
// Long text pages at a sentence end when it would pass 3 lines.
import type { Line } from '../engine/lines';
import { frameLoop } from '../engine/clock';
import { settings } from '../engine/settings';
import { audio } from '../engine/audio';
import { pushKeys } from './input';
import type { StageRefs } from './stage';

export interface BacklogEntry {
  who: string;
  text: string;
}

export class Dialogue {
  private box: HTMLElement;
  private textEl: HTMLElement;
  private shown: HTMLSpanElement;
  private rest: HTMLSpanElement;
  private plate: HTMLElement;
  private modesEl: HTMLElement;
  private measure: HTMLElement;
  backlog: BacklogEntry[] = [];
  auto = false;
  skip = false;
  /** Called when the visible speaker changes (for sprite dimming / Mimi's waveform). */
  onSpeaker: (who: string | null) => void = () => {};

  constructor(private refs: StageRefs) {
    const layer = refs.layer.dialogue;
    this.plate = document.createElement('div');
    this.plate.className = 'nameplate px';
    this.box = document.createElement('div');
    this.box.className = 'dlg px';
    this.box.setAttribute('role', 'button');
    this.box.setAttribute('aria-label', 'Continue');
    this.textEl = document.createElement('div');
    this.textEl.className = 'text';
    this.shown = document.createElement('span');
    this.rest = document.createElement('span');
    this.rest.className = 'hidden';
    this.rest.setAttribute('aria-hidden', 'true');
    this.textEl.append(this.shown, this.rest);
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    this.modesEl = document.createElement('div');
    this.modesEl.className = 'modes';
    this.box.append(this.textEl, arrow, this.modesEl);
    this.measure = document.createElement('div');
    this.measure.className = 'dlg px dlg-measure';
    this.measure.setAttribute('aria-hidden', 'true');
    this.measure.style.visibility = 'hidden';
    this.measure.style.pointerEvents = 'none';
    const mt = document.createElement('div');
    mt.className = 'text';
    mt.style.height = 'auto';
    this.measure.appendChild(mt);
    this.hide();
    layer.append(this.box, this.plate, this.measure);
  }

  private token = 0;
  /** Abandons the line being typed (load, rewind, quit). */
  cancel() {
    this.token++;
    this.hide();
  }

  hide() {
    this.box.style.display = 'none';
    this.plate.style.display = 'none';
    this.onSpeaker(null);
  }

  setModes() {
    const m = [this.auto ? 'AUTO' : '', this.skip ? 'SKIP' : ''].filter(Boolean).join(' · ');
    this.modesEl.textContent = m;
  }

  private pages(text: string, cls: string): string[] {
    const mt = this.measure.firstChild as HTMLElement;
    this.measure.className = 'dlg px dlg-measure ' + cls;
    const fits = (t: string) => {
      mt.textContent = t;
      return mt.scrollHeight <= 168 + 2;
    };
    if (fits(text)) return [text];
    const sentences = text.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) ?? [text];
    const out: string[] = [];
    let cur = '';
    for (const s of sentences) {
      if (cur && !fits(cur + s)) {
        out.push(cur.trim());
        cur = '';
      }
      cur += s;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /** Shows one line; resolves when the player has read every page. */
  async show(line: Line, opts: { seen?: boolean; raised?: boolean } = {}): Promise<void> {
    const cls = line.kind === 'speech' ? 'speech' : line.kind;
    this.box.className = 'dlg px ' + cls;
    this.box.style.display = '';
    this.refs.layer.dialogue.classList.toggle('raised', !!opts.raised);
    let who = '';
    if (line.kind === 'speech') {
      who = line.speaker! + (line.vo ? ' (V.O.)' : '');
      this.plate.replaceChildren();
      if (line.radio) {
        const a = document.createElement('span');
        a.className = 'antenna';
        a.setAttribute('aria-label', 'radio');
        this.plate.appendChild(a);
      }
      this.plate.append(who);
      this.plate.style.display = '';
    } else if (line.kind === 'debrief') {
      who = 'DEBRIEF';
      this.plate.replaceChildren('DEBRIEF');
      this.plate.style.display = '';
    } else {
      this.plate.style.display = 'none';
    }
    this.onSpeaker(line.kind === 'speech' ? line.speaker! : null);
    const prefix = line.direction ? `(${line.direction}) ` : '';
    const full = prefix + line.text;
    this.backlog.push({ who: who || (line.kind === 'system' ? '·' : ''), text: full });
    if (this.backlog.length > 300) this.backlog.shift();
    this.refs.live.textContent = (who ? who + ': ' : '') + full;

    const pages = this.pages(full, cls);
    for (let i = 0; i < pages.length; i++) {
      await this.typePage(pages[i], i === 0 ? Math.min(prefix.length, pages[i].length) : 0, opts.seen ?? false);
    }
    this.refs.layer.dialogue.classList.remove('raised');
  }

  private typePage(page: string, dirLen: number, seen: boolean): Promise<void> {
    const myToken = this.token;
    return new Promise((resolve) => {
      let shownCount = 0;
      let done = false;
      let finished = false;
      const render = () => {
        const vis = page.slice(0, shownCount);
        this.shown.replaceChildren();
        if (dirLen > 0) {
          const d = document.createElement('span');
          d.className = 'dir';
          d.textContent = vis.slice(0, dirLen);
          this.shown.append(d, vis.slice(dirLen));
        } else this.shown.textContent = vis;
        this.rest.textContent = page.slice(shownCount);
      };
      const complete = () => {
        shownCount = page.length;
        done = true;
        render();
        this.box.classList.add('done');
        stop();
        if (this.skip && seen) setTimeout(advance, 60);
        else if (this.auto) autoTimer = window.setTimeout(advance, settings.autoDelay + page.length * 15);
      };
      let autoTimer = 0;
      const advance = () => {
        if (finished || myToken !== this.token) return;
        if (!done) return complete();
        finished = true;
        clearTimeout(autoTimer);
        this.box.classList.remove('done');
        this.box.removeEventListener('click', onClick);
        unkeys();
        resolve();
      };
      const onClick = (e: Event) => {
        e.stopPropagation();
        audio.unlock();
        if (done) audio.sfx('blip');
        advance();
      };
      this.box.addEventListener('click', onClick);
      const unkeys = pushKeys((e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          if (!e.repeat) advance();
          return true;
        }
        return false;
      });
      this.box.classList.remove('done');
      const cps = settings.textSpeed;
      let acc = 0;
      let stop: () => void = () => {};
      if (cps === 0 || (this.skip && seen)) {
        complete();
        return;
      }
      render();
      stop = frameLoop((dt) => {
        if (myToken !== this.token) return stop();
        acc += (dt / 1000) * cps;
        const n = Math.floor(acc);
        if (n > 0) {
          acc -= n;
          shownCount = Math.min(page.length, shownCount + n);
          if (shownCount % 3 === 0) audio.sfx('type');
          render();
          if (shownCount >= page.length) complete();
        }
      });
    });
  }
}
