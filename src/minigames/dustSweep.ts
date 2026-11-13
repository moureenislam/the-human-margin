// Dust Sweep (4.1). Swipe the wipers across 6 rows of panels.
// Clean: POWER_REFILL 10. Half (3–5 rows, design choice): 9. Skipped: stays 7.
import type { Minigame, MinigameContext, Outcomes } from './types';
import { el, injectCss, makeFrame, button, onKeys, stagePoint, stageRect, wait } from './kit';
import { refillFromRows } from '../engine/rules';

const ROWS = 6;
const BINS = 20; // a row is clean once 18 of its 20 strips have been wiped
const TIME_MS = 20000; // generous limit (design choice)

const CSS = `
.dw-content{position:absolute;left:24px;right:24px;top:72px;bottom:24px;display:flex;flex-direction:column;gap:12px}
.dw-row{position:relative;display:flex;height:72px;border:4px solid var(--edge);cursor:ew-resize;touch-action:none;
  background:repeating-linear-gradient(90deg,var(--panel-light) 0 92px,var(--ink) 92px 96px),var(--panel-light)}
.dw-row:focus-visible,.dw-row.cur{border-color:var(--gold);outline:none}
.dw-row.clean{border-color:var(--green)}
.dw-row .tag{position:absolute;left:8px;top:16px;z-index:2;padding:0 8px;background:var(--ink)}
.dw-bin{flex:1;background:var(--muted);opacity:.92;
  background-image:repeating-linear-gradient(45deg,transparent 0 8px,rgba(11,15,26,.35) 8px 12px)}
.dw-bin.wiped{opacity:0}
.dw-wiper{position:absolute;top:-8px;bottom:-8px;width:8px;background:var(--gold);display:none;z-index:3}
.dw-foot{display:flex;align-items:center;gap:24px;margin-top:auto}
.dw-foot .grow{flex:1;font-size:32px}
`;

export const dustSweep: Minigame<'dust_sweep'> = {
  id: 'dust_sweep',
  run(ctx: MinigameContext) {
    injectCss('dust-sweep', CSS);
    return new Promise<Outcomes['dust_sweep']>((resolve) => {
      const f = makeFrame(ctx, 'Dust sweep · solar array', 'Swipe across each row of panels. Keyboard: Up/Down to pick a row, Space to wipe it.', { top: 64, height: 840 });
      const content = el('div', 'dw-content', undefined, f.body);

      const wiped: boolean[][] = [];
      const clean: boolean[] = [];
      const rowEls: HTMLElement[] = [];
      const binEls: HTMLElement[][] = [];
      let cur = 0;
      let done = false;
      let remaining = TIME_MS;
      const cleanups: Array<() => void> = [];

      for (let r = 0; r < ROWS; r++) {
        wiped.push(new Array(BINS).fill(false));
        clean.push(false);
        const row = el('div', 'dw-row', undefined, content);
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', `Panel row ${r + 1}: dusty. Swipe or press Space to wipe.`);
        const bins: HTMLElement[] = [];
        for (let b = 0; b < BINS; b++) bins.push(el('div', 'dw-bin', undefined, row));
        el('span', 'label tag', `Row ${r + 1}`, row);
        const wiper = el('div', 'dw-wiper', undefined, row);
        rowEls.push(row);
        binEls.push(bins);

        let lastX: number | null = null;
        let rect = { x: 0, y: 0, w: 1, h: 1 };
        const down = (e: PointerEvent) => {
          if (done) return;
          e.preventDefault();
          row.setPointerCapture(e.pointerId);
          rect = stageRect(row);
          lastX = stagePoint(e).x - rect.x;
          setCur(r);
          wiper.style.display = 'block';
          sweep(r, lastX, lastX);
        };
        const move = (e: PointerEvent) => {
          if (lastX === null || done) return;
          const x = stagePoint(e).x - rect.x;
          wiper.style.left = Math.round(Math.max(0, Math.min(rect.w - 8, x)) / 4) * 4 + 'px';
          sweep(r, lastX, x);
          lastX = x;
        };
        const up = () => {
          lastX = null;
          wiper.style.display = 'none';
        };
        row.addEventListener('pointerdown', down);
        row.addEventListener('pointermove', move);
        row.addEventListener('pointerup', up);
        row.addEventListener('pointercancel', up);
        row.addEventListener('click', (e) => e.stopPropagation());
        row.addEventListener('focus', () => setCur(r));
        cleanups.push(() => {
          row.removeEventListener('pointerdown', down);
          row.removeEventListener('pointermove', move);
          row.removeEventListener('pointerup', up);
          row.removeEventListener('pointercancel', up);
        });
      }

      const foot = el('div', 'dw-foot', undefined, content);
      const preview = el('div', 'grow', '', foot);
      preview.setAttribute('aria-live', 'polite');
      const skipB = button('Skip', () => finish(true), foot, 'small');
      const doneB = button('Done', () => finish(false), foot, 'primary');

      function cleanCount() {
        return clean.filter(Boolean).length;
      }

      function setCur(r: number) {
        cur = r;
        rowEls.forEach((row, i) => row.classList.toggle('cur', i === r));
      }

      function sweep(r: number, x0: number, x1: number) {
        if (clean[r]) return;
        const w = stageRect(rowEls[r]).w || 1;
        const a = Math.max(0, Math.floor((Math.min(x0, x1) / w) * BINS));
        const b = Math.min(BINS - 1, Math.floor((Math.max(x0, x1) / w) * BINS));
        for (let i = a; i <= b; i++) {
          if (!wiped[r][i]) {
            wiped[r][i] = true;
            binEls[r][i].classList.add('wiped');
          }
        }
        if (wiped[r].filter(Boolean).length >= BINS - 2) markClean(r);
      }

      function markClean(r: number) {
        if (clean[r]) return;
        clean[r] = true;
        wiped[r].fill(true);
        binEls[r].forEach((b) => b.classList.add('wiped'));
        rowEls[r].classList.add('clean');
        rowEls[r].setAttribute('aria-label', `Panel row ${r + 1}: clean.`);
        ctx.sfx('blip');
        update();
        if (cleanCount() === ROWS) finish(false);
      }

      function update() {
        const n = cleanCount();
        preview.innerHTML = '';
        preview.append(`${n}/${ROWS} rows clean · Power refill tomorrow: `);
        const v = refillFromRows(n);
        el('span', v === 10 ? 'green' : v === 9 ? 'amber' : 'red', String(v), preview);
        if (n > 0) skipB.style.display = 'none';
      }

      cleanups.push(
        onKeys((e) => {
          if (done) return;
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = Math.max(0, Math.min(ROWS - 1, cur + (e.key === 'ArrowUp' ? -1 : 1)));
            setCur(n);
            rowEls[n].focus();
          } else if (e.key === ' ') {
            const active = document.activeElement;
            if (active instanceof HTMLButtonElement && ctx.root.contains(active)) return;
            e.preventDefault();
            markClean(cur);
          }
        }),
      );

      cleanups.push(
        ctx.onFrame((dt) => {
          if (done) return;
          remaining -= dt;
          const s = Math.max(0, Math.ceil(remaining / 1000));
          f.right.textContent = `${s} s`;
          f.right.className = 'mg-timer ' + (s > 10 ? '' : s > 5 ? 'amber' : 'red');
          if (remaining <= 0) finish(false);
        }),
      );

      async function finish(skipped: boolean) {
        if (done) return;
        done = true;
        cleanups.forEach((c) => c());
        skipB.disabled = doneB.disabled = true;
        const rows = skipped ? 0 : cleanCount();
        const v = refillFromRows(rows);
        f.help.textContent = skipped ? 'Panels left dusty. Refill stays 7.' : `${rows} rows clean. Power refill tomorrow: ${v}.`;
        f.help.className = 'mg-help ' + (v === 10 ? 'green' : v === 9 ? 'amber' : 'red');
        ctx.sfx(v === 10 ? 'success' : 'blip');
        await wait(ctx, 1000);
        ctx.root.innerHTML = '';
        resolve({ rows });
      }

      update();
      setCur(0);
      rowEls[0].focus();
    });
  },
};
