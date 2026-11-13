// Launch Checklist (scene 5.3): tap 8 steps in order. Twice a "SKIP · save 30 seconds" button tempts the player.
// Pressing both skips sets IGNORED = 2 (via outcomes.ts).
import { button, el, injectCss, makeFrame, onKeys, wait } from './kit';
import type { Minigame } from './types';

const STEPS = ['Seal hatch', 'Check pressure', 'Check Power', 'Stow samples', 'Arm engines', 'Confirm crew count', 'Read back', 'Go'];
const SKIP_AT = new Set([2, 5]); // when step 3 and step 6 become next

const CSS = `
.lc-grid { position: absolute; left: 24px; right: 24px; top: 80px; display: grid;
  grid-template-columns: 1fr 1fr; grid-auto-flow: column; grid-template-rows: repeat(4, 112px); gap: 16px 32px; }
.lc-row { display: flex; align-items: center; gap: 16px; }
.lc-step { flex: 1; height: 112px; justify-content: flex-start; text-align: left; font-family: var(--font-body);
  font-size: 32px; text-transform: none; }
.lc-step .box { font-family: var(--font-label); font-size: 32px; width: 48px; }
.lc-step.done { border-color: var(--green); }
.lc-step.done .box { color: var(--green); }
.lc-step.skipped { border-color: var(--amber); color: var(--muted); text-decoration: line-through; }
.lc-step.skipped .box { color: var(--amber); }
.lc-step.next { border-color: var(--gold); background: var(--panel-light); }
.lc-skip { min-height: 112px; border-color: var(--amber); color: var(--amber); animation: lcglow 1s steps(2) infinite; }
.reduce-motion .lc-skip { animation: none; }
@keyframes lcglow { 50% { background: var(--panel-light); } }
.lc-status { position: absolute; left: 24px; bottom: 24px; font-size: 28px; }
`;

export const launchChecklist: Minigame<'launch_checklist'> = {
  id: 'launch_checklist',
  run(ctx) {
    injectCss('launch-checklist', CSS);
    return new Promise((resolve) => {
      const f = makeFrame(ctx, 'Launch Checklist · Halcyon', 'Tap each step in order. Enter or Space does the next step.', {
        top: 48,
        height: 740,
      });
      const grid = el('div', 'lc-grid', undefined, f.body);
      const status = el('div', 'lc-status muted', '', f.body);
      status.setAttribute('aria-live', 'polite');
      const state: Array<'todo' | 'done' | 'skipped'> = STEPS.map(() => 'todo');
      const rows: HTMLElement[] = [];
      const btns: HTMLButtonElement[] = [];
      let next = 0;
      let skips = 0;
      let skipBtn: HTMLButtonElement | null = null;
      let done = false;

      STEPS.forEach((name, i) => {
        const row = el('div', 'lc-row', undefined, grid);
        const b = button('', () => tap(i), row, 'lc-step');
        el('span', 'box', '☐', b);
        el('span', '', `${i + 1}. ${name}`, b);
        rows.push(row);
        btns.push(b);
      });

      function render() {
        STEPS.forEach((name, i) => {
          const b = btns[i];
          const s = state[i];
          b.classList.toggle('done', s === 'done');
          b.classList.toggle('skipped', s === 'skipped');
          b.classList.toggle('next', i === next && !done);
          (b.querySelector('.box') as HTMLElement).textContent = s === 'done' ? '☑' : s === 'skipped' ? '☒' : '☐';
          b.setAttribute('aria-label', `${i + 1}. ${name}, ${s === 'todo' ? (i === next ? 'next' : 'to do') : s}`);
        });
        skipBtn?.remove();
        skipBtn = null;
        if (!done && SKIP_AT.has(next) && state[next] === 'todo') {
          skipBtn = button('Skip · save 30 seconds', () => skip(), rows[next], 'lc-skip');
        }
        status.textContent = done ? 'Checklist finished.' : `Next: ${STEPS[next]}`;
      }

      function advance() {
        next++;
        if (next >= STEPS.length) {
          done = true;
          render();
          void finish();
          return;
        }
        render();
        btns[next].focus();
      }

      function tap(i: number) {
        if (done) return;
        if (i !== next) {
          ctx.sfx('thud');
          const b = btns[i];
          b.classList.remove('shake');
          void b.offsetWidth;
          if (!ctx.reduceMotion) b.classList.add('shake');
          return;
        }
        state[i] = 'done';
        ctx.sfx(i === STEPS.length - 1 ? 'success' : 'blip');
        advance();
      }

      function skip() {
        if (done) return;
        state[next] = 'skipped';
        skips++;
        ctx.sfx('tick');
        advance();
      }

      const offKeys = onKeys((e) => {
        if (done) return;
        if (e.key === 'Enter' || e.key === ' ') {
          // A focused button (like Skip) handles its own Enter/Space.
          const a = document.activeElement;
          if (a && a !== document.body && a.tagName === 'BUTTON' && a !== btns[next]) return;
          e.preventDefault();
          tap(next);
        }
      });

      async function finish() {
        offKeys();
        await wait(ctx, 900);
        ctx.root.innerHTML = '';
        ctx.setRef(null);
        resolve({ skips: Math.min(2, skips) as 0 | 1 | 2 });
      }

      render();
      btns[0].focus();
    });
  },
};
