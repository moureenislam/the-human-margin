// Final Budget (scene 5.2): split tonight's cubes between AIR, SHIELD and LAUNCH.
// Lines: AIR 3, LAUNCH 4, SHIELD from card D8 (1, 2 or 3). Budget cubes don't change the AIR/SHIELD bars (rule R9).
import { LIMITS } from '../engine/rules';
import { button, el, inside, injectCss, makeDraggable, makeFrame, onKeys, stageRect } from './kit';
import type { Minigame } from './types';

type Bin = 'air' | 'shield' | 'launch';
const BINS: Bin[] = ['air', 'shield', 'launch'];
const NAMES: Record<Bin, string> = { air: 'Air', shield: 'Shield', launch: 'Launch' };

const CSS = `
.fb-top { position: absolute; left: 24px; right: 24px; top: 72px; display: flex; gap: 24px; align-items: stretch; }
.fb-pool { flex: 1; min-height: 120px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.fb-food { width: 360px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.fb-cubes { display: flex; flex-wrap: wrap; gap: 8px; min-height: 64px; }
.fb-cube { width: 56px; height: 56px; background: var(--gold); border: 4px solid var(--ink); cursor: grab; }
.fb-bins { position: absolute; left: 24px; right: 24px; top: 264px; display: flex; gap: 24px; }
.fb-bin { flex: 1; height: 264px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.fb-bin.sel { background: var(--panel-light); }
.fb-bin .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.fb-bin .count { font-size: 32px; }
.fb-bin .px-btn { min-height: 64px; width: 80px; padding: 0; font-size: 32px; }
.fb-bottom { position: absolute; left: 24px; right: 24px; bottom: 16px; display: flex; align-items: center; gap: 24px; }
.fb-note { flex: 1; font-size: 28px; }
.fb-pulse { animation: fbpulse 0.5s steps(2) 4; }
@keyframes fbpulse { 50% { border-color: var(--red); } }
`;

export const finalBudget: Minigame<'final_budget'> = {
  id: 'final_budget',
  run(ctx) {
    injectCss('final-budget', CSS);
    return new Promise((resolve) => {
      const cubes = Number(ctx.vars.POWER ?? 10);
      const lines: Record<Bin, number> = {
        air: LIMITS.budgetAir,
        shield: Number(ctx.vars.SHIELD_LINE ?? 3),
        launch: LIMITS.budgetLaunch,
      };
      const food = Number(ctx.vars.FOOD ?? 0);
      ctx.setRef('D8', `${ctx.vars.D8_SOURCE ?? ''} · ${ctx.vars.D8_FETCHED ?? ''}`);

      const f = makeFrame(
        ctx,
        `Final Budget · ${cubes} cubes`,
        'Drag cubes into a bin, or use + and −. Keys: 1/2/3 pick a bin, + or − (arrows) move a cube.',
        { top: 48, height: 740 },
      );
      const alloc: Record<Bin, number> = { air: 0, shield: 0, launch: 0 };
      let selected: Bin = 'air';
      let warnings = 0;
      let busy = false;
      let done = false;
      const dragCleanups: Array<() => void> = [];

      const top = el('div', 'fb-top', undefined, f.body);
      const pool = el('div', 'fb-pool px', undefined, top);
      const poolLabel = el('div', 'label muted', '', pool);
      const poolCubes = el('div', 'fb-cubes', undefined, pool);
      const foodBox = el('div', 'fb-food px', undefined, top);
      el('div', 'label muted', 'Food (checked tonight)', foodBox);
      const foodOk = food >= LIMITS.foodLine;
      el('div', 'count ' + (foodOk ? 'green' : 'red'), `${food} days / ${LIMITS.foodLine} ${foodOk ? '✓ OK' : '✗ LOW'}`, foodBox);

      const binsWrap = el('div', 'fb-bins', undefined, f.body);
      const binEls = {} as Record<Bin, { box: HTMLElement; count: HTMLElement; cubes: HTMLElement; plus: HTMLButtonElement; minus: HTMLButtonElement }>;
      for (const b of BINS) {
        const box = el('div', 'fb-bin px', undefined, binsWrap);
        box.setAttribute('role', 'group');
        box.setAttribute('aria-label', NAMES[b]);
        box.addEventListener('pointerdown', () => {
          selected = b;
          render();
        });
        const head = el('div', 'row', undefined, box);
        el('div', 'label gold', NAMES[b], head);
        const count = el('div', 'count', '', head);
        count.setAttribute('aria-live', 'polite');
        const cubesEl = el('div', 'fb-cubes', undefined, box);
        const ctrl = el('div', 'row', undefined, box);
        const minus = button('−', () => change(b, -1), ctrl, 'small');
        minus.setAttribute('aria-label', `Remove a cube from ${NAMES[b]}`);
        const plus = button('+', () => change(b, 1), ctrl, 'small');
        plus.setAttribute('aria-label', `Add a cube to ${NAMES[b]}`);
        binEls[b] = { box, count, cubes: cubesEl, plus, minus };
      }

      const bottom = el('div', 'fb-bottom', undefined, f.body);
      const note = el('div', 'fb-note', '', bottom);
      note.setAttribute('aria-live', 'polite');
      const confirm = button('Confirm budget', () => void onConfirm(), bottom, 'primary');

      const short = lines.air + lines.shield + lines.launch > cubes;

      function free() {
        return cubes - alloc.air - alloc.shield - alloc.launch;
      }

      function change(b: Bin, d: number) {
        if (busy || done) return;
        if (d > 0 && free() <= 0) return ctx.sfx('thud');
        if (d < 0 && alloc[b] <= 0) return ctx.sfx('thud');
        alloc[b] += d;
        selected = b;
        ctx.sfx('blip');
        render();
      }

      function binAt(pt: { x: number; y: number }): Bin | 'pool' | null {
        for (const b of BINS) if (inside(pt, stageRect(binEls[b].box))) return b;
        if (inside(pt, stageRect(pool))) return 'pool';
        return null;
      }

      function cube(parent: HTMLElement, from: Bin | 'pool') {
        const c = el('div', 'fb-cube', undefined, parent);
        c.setAttribute('aria-hidden', 'true');
        dragCleanups.push(
          makeDraggable(c, {
            onDrop: (pt) => {
              const to = binAt(pt);
              if (!to || to === from || busy || done) return false;
              requestAnimationFrame(() => {
                if (from !== 'pool') alloc[from] -= 1;
                if (to !== 'pool') alloc[to] += 1;
                if (to !== 'pool') selected = to;
                ctx.sfx('blip');
                render();
              });
              return true;
            },
          }),
        );
      }

      function render() {
        dragCleanups.splice(0).forEach((c) => c());
        poolLabel.textContent = `Unspent: ${free()}`;
        poolCubes.innerHTML = '';
        for (let i = 0; i < free(); i++) cube(poolCubes, 'pool');
        for (const b of BINS) {
          const e = binEls[b];
          const met = alloc[b] >= lines[b];
          e.box.classList.toggle('sel', b === selected);
          e.box.classList.toggle('green', met);
          e.box.classList.toggle('amber', !met);
          e.count.className = 'count ' + (met ? 'green' : 'amber');
          e.count.textContent = `${alloc[b]} / ${lines[b]} ${met ? '✓' : '!'}`;
          e.cubes.innerHTML = '';
          for (let i = 0; i < alloc[b]; i++) cube(e.cubes, b);
          e.plus.disabled = free() <= 0;
          e.minus.disabled = alloc[b] <= 0;
        }
        const below = BINS.filter((b) => alloc[b] < lines[b]);
        if (short) {
          note.className = 'fb-note red';
          note.textContent = `Not enough cubes for every line tonight. Lines need ${lines.air + lines.shield + lines.launch}, you have ${cubes}.`;
        } else if (below.length) {
          note.className = 'fb-note amber';
          note.textContent = 'Below the line: ' + below.map((b) => NAMES[b]).join(', ') + '.';
        } else {
          note.className = 'fb-note green';
          note.textContent = 'Every line is met.';
        }
      }

      async function sayOverGame(speaker: string, text: string) {
        // Let the dialogue box (under this layer) be seen and clicked while the line plays.
        const dim = ctx.root.querySelector('.mg-dim') as HTMLElement | null;
        if (dim) dim.style.display = 'none';
        ctx.root.style.pointerEvents = 'none';
        await ctx.say(speaker, text);
        ctx.root.style.pointerEvents = '';
        if (dim) dim.style.display = '';
      }

      async function onConfirm() {
        if (busy || done) return;
        const below = BINS.some((b) => alloc[b] < lines[b]);
        if (below && warnings < 2) {
          busy = true;
          confirm.disabled = true;
          warnings++;
          if (warnings === 1) {
            await sayOverGame('SIONE', 'Check the last number.');
          } else {
            ctx.sfx('alarm');
            if (!ctx.reduceMotion) {
              f.frame.classList.remove('fb-pulse');
              void f.frame.offsetWidth;
              f.frame.classList.add('fb-pulse');
            }
            f.frame.classList.add('red');
            await sayOverGame('AMARA', 'Stop. Read the card again.');
          }
          busy = false;
          confirm.disabled = false;
          return;
        }
        done = true;
        ctx.sfx(below ? 'fail' : 'success');
        offKeys();
        dragCleanups.forEach((c) => c());
        ctx.root.innerHTML = '';
        ctx.root.style.pointerEvents = '';
        ctx.setRef(null);
        resolve({ air: alloc.air, shield: alloc.shield, launch: alloc.launch });
      }

      const offKeys = onKeys((e) => {
        if (busy || done) return;
        if (e.key === '1' || e.key === '2' || e.key === '3') {
          selected = BINS[Number(e.key) - 1];
          ctx.sfx('tick');
          render();
        } else if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          change(selected, 1);
        } else if (e.key === '-' || e.key === '_' || e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          change(selected, -1);
        }
      });

      render();
    });
  },
};
