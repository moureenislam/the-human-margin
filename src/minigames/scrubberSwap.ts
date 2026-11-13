// Scrubber Swap (2.4). Drag each canister to the socket of the same shape and colour before AIR
// reaches 0. 60 s if 2.3 A was chosen, else 30 s (ctx.vars.SWAP_TIME). Wrong socket −5 s.
// Fail: one retry. Fail twice: SWAP_FAILED. Shapes carry the match, so colour is never needed.
import type { Minigame, MinigameContext } from './types';
import { el, injectCss, makeFrame, button, makeDraggable, stageRect, inside, onKeys, wait } from './kit';

const CSS = `
.ss-content{position:absolute;left:24px;right:24px;top:72px;bottom:24px;display:flex;flex-direction:column;gap:24px}
.ss-row{display:flex;gap:48px;justify-content:center;align-items:flex-start;min-height:224px}
.ss-can{flex-direction:column;gap:8px;width:192px;min-height:192px;padding:16px;cursor:grab}
.ss-can.sel{border-color:var(--gold);background:var(--panel-light)}
.ss-shape{width:96px;height:96px}
.ss-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;width:224px;min-height:224px;padding:16px;background:var(--ink);border:4px dashed var(--edge);color:var(--text);cursor:pointer}
.ss-slot:focus-visible,.ss-slot.cur{border-color:var(--gold);outline:none}
.ss-slot.full{border-style:solid;border-color:var(--green)}
.ss-hole{position:relative;width:128px;height:128px}
.ss-hole>.o,.ss-hole>.i{position:absolute}
.ss-hole>.o{inset:0}
.ss-hole>.i{inset:12px;background:var(--ink)}
.ss-air{display:flex;flex-direction:column;gap:8px}
.ss-airbar{position:relative;height:48px;background:var(--ink);border:4px solid var(--edge)}
.ss-airbar .fill{position:absolute;left:0;top:0;bottom:0;background:var(--green)}
.ss-airbar.amber .fill{background:var(--amber)}
.ss-airbar.red .fill{background:var(--red)}
`;

type Shape = 'square' | 'round' | 'triangle' | 'hex';
const SHAPES: Array<{ shape: Shape; color: string; colorName: string; clip: string }> = [
  { shape: 'square', color: 'var(--cyan)', colorName: 'cyan', clip: 'none' },
  { shape: 'round', color: 'var(--gold)', colorName: 'gold', clip: 'circle(50% at 50% 50%)' },
  { shape: 'triangle', color: 'var(--green)', colorName: 'green', clip: 'polygon(50% 0, 100% 100%, 0 100%)' },
  { shape: 'hex', color: 'var(--red)', colorName: 'red', clip: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)' },
];

function shuffled<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function shapeDiv(s: (typeof SHAPES)[number], cls: string, parent: HTMLElement) {
  const d = el('div', cls, undefined, parent);
  d.style.background = s.color;
  if (s.clip !== 'none') d.style.clipPath = s.clip;
  return d;
}

export const scrubberSwap: Minigame<'scrubber_swap'> = {
  id: 'scrubber_swap',
  async run(ctx: MinigameContext) {
    injectCss('scrubber-swap', CSS);
    const limitMs = (Number(ctx.vars.SWAP_TIME) || 30) * 1000;

    const playOnce = (attempt: 1 | 2) =>
      new Promise<boolean>((resolve) => {
        const f = makeFrame(
          ctx,
          attempt === 1 ? 'Scrubber swap' : 'Scrubber swap · second try',
          'Drag each canister to the socket with the same shape. Or press 1–4, then A–D.',
          { top: 64, height: 840 },
        );
        const content = el('div', 'ss-content', undefined, f.body);
        el('div', 'label muted', 'Spare canisters', content);
        const canRow = el('div', 'ss-row', undefined, content);
        el('div', 'label muted', 'Scrubber sockets', content);
        const slotRow = el('div', 'ss-row', undefined, content);
        const airWrap = el('div', 'ss-air', undefined, content);
        const airLabel = el('div', 'label', '', airWrap);
        const airBar = el('div', 'ss-airbar', undefined, airWrap);
        const airFill = el('div', 'fill', undefined, airBar);
        airBar.setAttribute('role', 'progressbar');
        airBar.setAttribute('aria-label', 'Air left');

        const cleanups: Array<() => void> = [];
        let remaining = limitMs;
        let finished = false;
        let selected = -1;
        let cursor = 0;
        let placed = 0;

        const canOrder = shuffled(SHAPES);
        const slotOrder = shuffled(SHAPES);
        const slotFull = slotOrder.map(() => false);

        const slots = slotOrder.map((s, i) => {
          const b = el('button', 'ss-slot', undefined, slotRow);
          b.type = 'button';
          b.setAttribute('aria-label', `Socket ${'ABCD'[i]}: ${s.shape}`);
          const hole = el('div', 'ss-hole', undefined, b);
          shapeDiv(s, 'o', hole);
          const inner = el('div', 'i', undefined, hole);
          if (s.clip !== 'none') inner.style.clipPath = s.clip;
          el('span', 'label', `${'ABCD'[i]} · ${s.shape}`, b);
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selected >= 0) attempt_(selected, i);
          });
          b.addEventListener('animationend', () => b.classList.remove('shake'));
          (b as any)._inner = inner;
          return b;
        });

        const cans = canOrder.map((s, i) => {
          const b = button('', () => select(i), canRow, 'ss-can');
          b.textContent = '';
          shapeDiv(s, 'ss-shape', b);
          el('span', 'label', `${i + 1} · ${s.shape}`, b);
          b.setAttribute('aria-label', `Canister ${i + 1}: ${s.colorName} ${s.shape}`);
          cleanups.push(
            makeDraggable(b, {
              onStart: () => select(i),
              onDrop: (pt) => {
                const target = slots.findIndex((sl) => inside(pt, stageRect(sl)));
                if (target >= 0) attempt_(i, target);
                return false;
              },
            }),
          );
          return b;
        });

        function select(i: number) {
          if (finished || cans[i].disabled) return;
          selected = i;
          cans.forEach((c, j) => c.classList.toggle('sel', j === i));
          f.help.textContent = `Canister ${i + 1} (${canOrder[i].shape}) picked up. Choose a socket: A–D.`;
        }

        function attempt_(ci: number, si: number) {
          if (finished || cans[ci].disabled || slotFull[si]) return;
          const c = canOrder[ci];
          const s = slotOrder[si];
          if (c.shape !== s.shape) {
            remaining -= 5000;
            ctx.sfx('thud');
            const sl = slots[si];
            sl.classList.remove('shake');
            void sl.offsetWidth;
            sl.classList.add('shake');
            f.help.textContent = `Wrong socket: that one is ${s.shape}. −5 seconds. No forcing.`;
            return;
          }
          slotFull[si] = true;
          placed++;
          const can = cans[ci];
          can.disabled = true;
          can.classList.remove('sel');
          can.style.transform = '';
          can.style.visibility = 'hidden';
          const inner = (slots[si] as any)._inner as HTMLElement;
          inner.style.background = s.color;
          inner.style.inset = '20px';
          slots[si].classList.add('full');
          slots[si].setAttribute('aria-label', `Socket ${'ABCD'[si]}: ${s.shape}, filled`);
          selected = -1;
          ctx.sfx('blip');
          f.help.textContent = placed < 4 ? `Clicked in. ${4 - placed} to go.` : 'All four seated. The fans pick up.';
          if (placed === 4) end(true);
        }

        cleanups.push(
          onKeys((e) => {
            const k = e.key.toLowerCase();
            const n = Number(k);
            if (n >= 1 && n <= 4) {
              e.preventDefault();
              select(n - 1);
            } else if ('abcd'.includes(k) && k.length === 1) {
              e.preventDefault();
              const si = 'abcd'.indexOf(k);
              cursor = si;
              slots.forEach((s, j) => s.classList.toggle('cur', j === cursor));
              if (selected >= 0) attempt_(selected, si);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              cursor = (cursor + (e.key === 'ArrowLeft' ? 3 : 1)) % 4;
              slots.forEach((s, j) => s.classList.toggle('cur', j === cursor));
            } else if (e.key === 'Enter') {
              const active = document.activeElement;
              if (active instanceof HTMLButtonElement && ctx.root.contains(active)) return; // native click handles it
              e.preventDefault();
              if (selected >= 0) attempt_(selected, cursor);
            }
          }),
        );

        cleanups.push(
          ctx.onFrame((dt) => {
            if (finished) return;
            remaining -= dt;
            const frac = Math.max(0, remaining / limitMs);
            airFill.style.width = frac * 100 + '%';
            airBar.classList.toggle('amber', frac <= 0.5 && frac > 0.25);
            airBar.classList.toggle('red', frac <= 0.25);
            airLabel.className = 'label ' + (frac > 0.5 ? 'green' : frac > 0.25 ? 'amber' : 'red');
            const secs = Math.max(0, Math.ceil(remaining / 1000));
            airLabel.textContent = `Air left: ${secs} s`;
            f.right.textContent = `${secs} s`;
            airBar.setAttribute('aria-valuenow', String(secs));
            if (remaining <= 0) end(false);
          }),
        );

        async function end(ok: boolean) {
          if (finished) return;
          finished = true;
          cleanups.forEach((c) => c());
          cans.forEach((c) => (c.disabled = true));
          ctx.sfx(ok ? 'success' : 'fail');
          if (!ok) f.help.textContent = 'Out of time. The air is getting thick.';
          f.help.className = 'mg-help ' + (ok ? 'green' : 'red');
          await wait(ctx, 1200);
          ctx.root.innerHTML = '';
          resolve(ok);
        }

        cans[0].focus();
      });

    if (await playOnce(1)) return { success: true, attempts: 1 };
    ctx.root.innerHTML = '';
    await ctx.say('SIONE', 'Again. Slower.');
    if (await playOnce(2)) return { success: true, attempts: 2 };
    return { success: false, attempts: 2 };
  },
};
