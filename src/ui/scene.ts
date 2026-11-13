// Background, sprites, radio insets, Mimi's call window and the comms timer.
import { bgImage, headCrop, spriteImage, spriteWho } from './assets';
import { frameLoop } from '../engine/clock';
import type { UiState } from '../engine/save';
import type { Slot } from '../engine/tags';
import type { StageRefs } from './stage';

const SLOTS: Slot[] = ['L', 'C', 'R'];

export class SceneView {
  private bgWrap: HTMLElement;
  private bgCode: string | null = null;
  private spriteEls: Partial<Record<Slot, { code: string; el: HTMLElement }>> = {};
  private insetEls: { code: string; el: HTMLElement }[] = [];
  private callEl: HTMLElement | null = null;
  private callMood: string | null = null;
  private callSpeaking = false;
  private stopWave: (() => void) | null = null;
  private timerEl: HTMLElement | null = null;
  private timerStop: (() => void) | null = null;

  constructor(private refs: StageRefs) {
    this.bgWrap = document.createElement('div');
    this.bgWrap.className = 'bg-wrap';
    refs.layer.bg.appendChild(this.bgWrap);
  }

  /** Brings the screen in line with a UI state (used on every change and on load/rewind). */
  render(ui: UiState) {
    this.setBg(ui.bg);
    for (const s of SLOTS) this.setSprite(s, ui.sprites[s] ?? null);
    this.setInsets(ui.insets);
    this.setCall(ui.call);
    this.setZoom(ui.zoom);
    this.setTimer(ui.timer);
  }

  setBg(code: string | null) {
    if (code === this.bgCode) return;
    this.bgCode = code;
    const old = [...this.bgWrap.children] as HTMLElement[];
    if (code) {
      const img = bgImage(code);
      this.bgWrap.appendChild(img);
    }
    for (const o of old) {
      o.classList.add('leaving');
      setTimeout(() => o.remove(), 650);
    }
  }

  setZoom(on: boolean) {
    this.bgWrap.classList.toggle('zoom', on);
  }

  private setSprite(slot: Slot, code: string | null) {
    const cur = this.spriteEls[slot];
    if (cur?.code === code) return;
    if (cur && code && spriteWho(cur.code) === spriteWho(code)) {
      // Same character, new expression: swap the image without movement.
      const img = spriteImage(code);
      cur.el.replaceChildren(img);
      cur.code = code;
      return;
    }
    cur?.el.remove();
    delete this.spriteEls[slot];
    if (!code) return;
    const el = document.createElement('div');
    el.className = 'sprite ' + slot;
    el.dataset.who = spriteWho(code);
    el.appendChild(spriteImage(code));
    this.refs.layer.sprites.appendChild(el);
    this.spriteEls[slot] = { code, el };
  }

  private setInsets(codes: string[]) {
    const same = codes.length === this.insetEls.length && codes.every((c, i) => this.insetEls[i].code === c);
    if (same) return;
    this.insetEls.forEach((i) => i.el.remove());
    this.insetEls = codes.slice(0, 2).map((code, i) => {
      const el = document.createElement('div');
      el.className = 'inset px solid cyan';
      el.style.top = (i === 0 ? 256 : 516) + 'px';
      el.dataset.who = spriteWho(code);
      el.appendChild(headCrop(code, 200));
      const scan = document.createElement('div');
      scan.className = 'scan';
      el.appendChild(scan);
      const cap = document.createElement('div');
      cap.className = 'cap';
      cap.textContent = spriteWho(code);
      el.appendChild(cap);
      this.refs.layer.insets.appendChild(el);
      return { code, el };
    });
  }

  /** Highlights whoever is talking: others on stage dim slightly. */
  speaking(who: string | null) {
    const onStage = SLOTS.some((s) => this.spriteEls[s] && this.spriteEls[s]!.el.dataset.who === who);
    for (const s of SLOTS) {
      const e = this.spriteEls[s];
      if (e) e.el.classList.toggle('dim', !!who && onStage && e.el.dataset.who !== who);
    }
    for (const i of this.insetEls) i.el.classList.toggle('speaking', i.el.dataset.who === who);
    this.callSpeaking = who === 'MIMI';
  }

  private setCall(mood: string | null) {
    if (mood === this.callMood) return;
    this.callMood = mood;
    this.stopWave?.();
    this.stopWave = null;
    this.callEl?.remove();
    this.callEl = null;
    if (!mood) return;
    const el = document.createElement('div');
    el.className = 'call px solid ' + mood;
    el.setAttribute('aria-label', 'Call with Mimi on Earth');
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = 'CALL · MIMI · EARTH';
    const wave = document.createElement('div');
    wave.className = 'wave';
    const bars: HTMLElement[] = [];
    for (let i = 0; i < 16; i++) {
      const b = document.createElement('i');
      wave.appendChild(b);
      bars.push(b);
    }
    el.append(who, wave);
    this.refs.layer.hud.appendChild(el);
    this.callEl = el;
    let t = 0;
    this.stopWave = frameLoop((dt) => {
      t += dt;
      if (t < 90) return;
      t = 0;
      for (const b of bars) {
        const h = this.callSpeaking && !document.body.classList.contains('reduce-motion') ? 8 + Math.floor(Math.random() * 5) * 8 : 8;
        b.style.height = h + 'px';
      }
    });
  }

  private setTimer(text: string | null) {
    this.timerStop?.();
    this.timerStop = null;
    this.timerEl?.remove();
    this.timerEl = null;
    if (!text) return;
    const el = document.createElement('div');
    el.className = 'timer px solid red';
    this.refs.layer.hud.appendChild(el);
    this.timerEl = el;
    // "COMMS LOST 3:00" counts down for atmosphere only; it changes no variable.
    const m = /(\d+):(\d\d)/.exec(text);
    let left = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
    const label = text.replace(/\s*\d+:\d\d\s*/, '').trim();
    const draw = () => (el.textContent = `${label} ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
    draw();
    let acc = 0;
    this.timerStop = frameLoop((dt) => {
      acc += dt;
      if (acc >= 1000 && left > 0) {
        acc -= 1000;
        left--;
        draw();
      }
    });
  }
}
