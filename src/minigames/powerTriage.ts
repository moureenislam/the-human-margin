// Power Triage (scene 4.2): order 7 systems from "stays on longest" (top) to "first to go dark" (bottom).
// Correctness is not shown here; the story reads TRIAGE_WRONG later.
import { button, el, injectCss, makeDraggable, makeFrame, onKeys, stageRect, wait } from './kit';
import type { Minigame } from './types';

const SYSTEMS = ['Scrubbers', 'Heaters', 'Shelter', 'Comms', 'Rover', 'Lab', 'Lights'];
const ROW_H = 84;
const GAP = 8;

const CSS = `
.pt-wrap { position: absolute; left: 24px; right: 24px; top: 72px; bottom: 24px; display: flex; gap: 32px; }
.pt-meter { width: 48px; position: relative; background: var(--ink); border: 4px solid var(--edge); }
.pt-meter .seg { position: absolute; left: 4px; right: 4px; background: var(--green); }
.pt-list { position: relative; width: 1000px; }
.pt-row { position: absolute; left: 0; right: 0; height: ${ROW_H}px; display: flex; align-items: center; gap: 16px;
  padding: 0 16px; cursor: grab; background: var(--panel-solid); }
.pt-row.sel { border-color: var(--gold); background: var(--panel-light); }
.pt-row .num { font-family: var(--font-label); font-size: 24px; color: var(--muted); width: 48px; }
.pt-row .name { flex: 1; font-size: 32px; }
.pt-row .px-btn { min-height: 64px; width: 72px; padding: 0; }
.pt-side { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.pt-side .tag { padding: 12px 16px; }
.pt-msg { font-size: 32px; color: var(--gold); min-height: 48px; }
`;

function shuffled(): string[] {
  // Deterministic-looking shuffle that never starts in the "correct" top three.
  const a = [...SYSTEMS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const top = new Set(a.slice(0, 3));
  if (['Scrubbers', 'Heaters', 'Shelter'].every((s) => top.has(s))) a.reverse();
  return a;
}

export const powerTriage: Minigame<'power_triage'> = {
  id: 'power_triage',
  run(ctx) {
    injectCss('power-triage', CSS);
    return new Promise((resolve) => {
      const f = makeFrame(
        ctx,
        'Power Triage · what stays on',
        'Drag, or select with Up/Down and move with Shift+Up/Down. Power runs out from the bottom up.',
        { top: 40, height: 1000 },
      );
      const wrap = el('div', 'pt-wrap', undefined, f.body);
      const meter = el('div', 'pt-meter', undefined, wrap);
      meter.setAttribute('aria-hidden', 'true');
      const list = el('div', 'pt-list', undefined, wrap);
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', 'Systems, top stays on longest');
      list.style.height = SYSTEMS.length * (ROW_H + GAP) + 'px';
      meter.style.height = SYSTEMS.length * (ROW_H + GAP) - GAP + 'px';
      const side = el('div', 'pt-side', undefined, wrap);
      el('div', 'tag px green label', '▲ Stays on longest', side);
      const msg = el('div', 'pt-msg', '', side);
      msg.setAttribute('aria-live', 'polite');
      const confirm = button('Lock in order', () => finish(), side, 'primary');
      el('div', 'tag px red label', '▼ First to go dark', side);

      let order = shuffled();
      let selected = 0;
      let done = false;
      const cleanups: Array<() => void> = [];

      function move(from: number, to: number) {
        if (to < 0 || to >= order.length || from === to) return;
        const [it] = order.splice(from, 1);
        order.splice(to, 0, it);
        selected = to;
        ctx.sfx('blip');
        render();
      }

      function render() {
        cleanups.splice(0).forEach((c) => c());
        list.innerHTML = '';
        meter.querySelectorAll('.seg').forEach((s) => s.remove());
        order.forEach((name, i) => {
          const row = el('div', 'pt-row px' + (i === selected ? ' sel' : ''), undefined, list);
          row.style.top = i * (ROW_H + GAP) + 'px';
          // Bottom rows lose power first: dim them progressively.
          const dark = Math.max(0, i - 3);
          row.style.opacity = String(1 - dark * 0.18);
          row.setAttribute('role', 'option');
          row.setAttribute('aria-selected', String(i === selected));
          row.setAttribute('aria-label', `${i + 1}. ${name}`);
          el('span', 'num', String(i + 1), row);
          el('span', 'name', name, row);
          const up = button('▲', () => move(i, i - 1), row, 'small');
          up.setAttribute('aria-label', `Move ${name} up`);
          up.disabled = i === 0;
          const down = button('▼', () => move(i, i + 1), row, 'small');
          down.setAttribute('aria-label', `Move ${name} down`);
          down.disabled = i === order.length - 1;
          for (const b of [up, down]) b.addEventListener('pointerdown', (e) => e.stopPropagation());
          row.addEventListener('pointerdown', () => {
            selected = i;
            row.classList.add('sel');
          });
          cleanups.push(
            makeDraggable(row, {
              onDrop: (pt) => {
                const lr = stageRect(list);
                const to = Math.max(0, Math.min(order.length - 1, Math.floor((pt.y - lr.y) / (ROW_H + GAP))));
                // Re-render on the next frame so the snap-back doesn't fight the new layout.
                requestAnimationFrame(() => move(i, to));
                return false;
              },
            }),
          );
          // Meter: segments light from the top; the bottom ones are drawn dim to show power running out.
          const seg = el('div', 'seg', undefined, meter);
          seg.style.top = i * (ROW_H + GAP) + 4 + 'px';
          seg.style.height = ROW_H - 8 + 'px';
          seg.style.background = i >= 6 ? 'var(--red)' : i >= 4 ? 'var(--amber)' : 'var(--green)';
          seg.style.opacity = String(1 - dark * 0.2);
        });
      }

      const offKeys = onKeys((e) => {
        if (done) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const d = e.key === 'ArrowUp' ? -1 : 1;
          if (e.shiftKey) move(selected, selected + d);
          else {
            selected = Math.max(0, Math.min(order.length - 1, selected + d));
            ctx.sfx('tick');
            render();
          }
        }
      });

      async function finish() {
        if (done) return;
        done = true;
        confirm.disabled = true;
        msg.textContent = 'Locked in.';
        ctx.sfx('chime');
        await wait(ctx, 700);
        cleanups.forEach((c) => c());
        offKeys();
        ctx.root.innerHTML = '';
        ctx.setRef(null);
        resolve({ order: [...order] });
      }

      render();
    });
  },
};
