// Small DOM helpers shared by the minigames. Everything is in stage pixels (1920×1080).
import { headCrop } from '../ui/assets';
import type { MinigameContext } from './types';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text?: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

/** Inject a minigame's own CSS once (scoped by a class prefix you choose). */
export function injectCss(id: string, css: string) {
  if (document.getElementById('css-' + id)) return;
  const s = document.createElement('style');
  s.id = 'css-' + id;
  s.textContent = css;
  document.head.appendChild(s);
}

export interface Frame {
  frame: HTMLElement;
  title: HTMLElement;
  right: HTMLElement; // right side of the title bar (timer etc.)
  body: HTMLElement;
  help: HTMLElement; // one-line instruction under the title
}

/** Standard minigame frame: dimmed scene, pixel panel, title bar, help line, body. */
export function makeFrame(ctx: MinigameContext, titleText: string, helpText: string, opts: { left?: number; top?: number; width?: number; height?: number } = {}): Frame {
  ctx.root.innerHTML = '';
  if (ctx.reduceMotion) ctx.root.classList.add('reduce-motion');
  el('div', 'mg-dim', undefined, ctx.root);
  const frame = el('div', 'mg-frame px solid', undefined, ctx.root);
  if (opts.left !== undefined) frame.style.left = opts.left + 'px';
  if (opts.top !== undefined) frame.style.top = opts.top + 'px';
  if (opts.width !== undefined) frame.style.width = opts.width + 'px';
  if (opts.height !== undefined) frame.style.height = opts.height + 'px';
  frame.setAttribute('role', 'dialog');
  frame.setAttribute('aria-label', titleText);
  const bar = el('div', 'mg-title', undefined, frame);
  const title = el('div', 'label gold', titleText, bar);
  const right = el('div', 'mg-timer', '', bar);
  const body = el('div', 'mg-body', undefined, frame);
  const help = el('div', 'mg-help', helpText, body);
  help.setAttribute('aria-live', 'polite');
  return { frame, title, right, body, help };
}

export function button(label: string, onClick: () => void, parent?: HTMLElement, cls = ''): HTMLButtonElement {
  const b = el('button', 'px-btn ' + cls, label, parent);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!b.disabled) onClick();
  });
  return b;
}

/** Converts a pointer event to stage coordinates (the stage is CSS-scaled). */
export function stagePoint(e: PointerEvent | MouseEvent): { x: number; y: number } {
  const stage = document.getElementById('stage')!;
  const r = stage.getBoundingClientRect();
  const scale = r.width / 1920;
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

export interface DragOptions {
  /** Called on drop with the stage point; return true to accept (element stays), false to snap back. */
  onDrop(pt: { x: number; y: number }, elem: HTMLElement): boolean | void;
  onStart?(): void;
  onMove?(pt: { x: number; y: number }): void;
}

/**
 * Pointer (mouse + touch) drag for an absolutely positioned element. The element moves with
 * transform while dragging and snaps back unless onDrop returns true.
 */
export function makeDraggable(elem: HTMLElement, opts: DragOptions): () => void {
  let start: { x: number; y: number } | null = null;
  const down = (e: PointerEvent) => {
    if ((elem as any).disabled) return;
    e.preventDefault();
    elem.setPointerCapture(e.pointerId);
    start = stagePoint(e);
    elem.style.zIndex = '10';
    opts.onStart?.();
  };
  const move = (e: PointerEvent) => {
    if (!start) return;
    const p = stagePoint(e);
    elem.style.transform = `translate(${Math.round((p.x - start.x) / 4) * 4}px, ${Math.round((p.y - start.y) / 4) * 4}px)`;
    opts.onMove?.(p);
  };
  const up = (e: PointerEvent) => {
    if (!start) return;
    const p = stagePoint(e);
    start = null;
    elem.style.zIndex = '';
    const keep = opts.onDrop(p, elem);
    if (!keep) elem.style.transform = '';
  };
  elem.addEventListener('pointerdown', down);
  elem.addEventListener('pointermove', move);
  elem.addEventListener('pointerup', up);
  elem.addEventListener('pointercancel', up);
  elem.style.touchAction = 'none';
  return () => {
    elem.removeEventListener('pointerdown', down);
    elem.removeEventListener('pointermove', move);
    elem.removeEventListener('pointerup', up);
    elem.removeEventListener('pointercancel', up);
  };
}

/** Stage-space rectangle of an element. */
export function stageRect(elem: HTMLElement): { x: number; y: number; w: number; h: number } {
  const stage = document.getElementById('stage')!;
  const sr = stage.getBoundingClientRect();
  const scale = sr.width / 1920;
  const r = elem.getBoundingClientRect();
  return { x: (r.left - sr.left) / scale, y: (r.top - sr.top) / scale, w: r.width / scale, h: r.height / scale };
}

export function inside(pt: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) {
  return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
}

/** Keyboard handler active while the minigame runs. Returns a remover. Esc is reserved for pause. */
const liveKeyListeners = new Set<() => void>();
export function onKeys(handler: (e: KeyboardEvent) => void): () => void {
  const h = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return;
    if (document.body.classList.contains('paused')) return;
    if (document.getElementById('l-menus')?.childElementCount) return;
    handler(e);
  };
  window.addEventListener('keydown', h);
  const remove = () => {
    window.removeEventListener('keydown', h);
    liveKeyListeners.delete(remove);
  };
  liveKeyListeners.add(remove);
  return remove;
}

/** Engine use: removes the key listeners of a minigame that was abandoned (load, rewind, quit). */
export function dropMinigameKeys() {
  for (const r of [...liveKeyListeners]) r();
}

/** Wait for unpaused game time. */
export function wait(ctx: MinigameContext, ms: number): Promise<void> {
  return new Promise((res) => {
    let t = 0;
    const stop = ctx.onFrame((dt) => {
      t += dt;
      if (t >= ms) {
        stop();
        res();
      }
    });
  });
}

/** Crew portrait (head crop of the neutral sprite) for AMARA / LUCIA / SIONE, or a "YOU" badge. */
export function portrait(who: 'AMARA' | 'LUCIA' | 'SIONE' | 'YOU', size = 160): HTMLElement {
  const code = who === 'AMARA' ? 'AMA-N' : who === 'LUCIA' ? 'LUC-N' : who === 'SIONE' ? 'SIO-N' : null;
  if (!code) {
    const d = el('div', 'headcrop px gold');
    d.style.width = d.style.height = size + 'px';
    const t = el('div', 'label gold', 'YOU', d);
    Object.assign(t.style, { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    return d;
  }
  return headCrop(code, size);
}
