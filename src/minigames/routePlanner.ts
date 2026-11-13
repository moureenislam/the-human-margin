// Route Planner (3.1). Pick a path across a 5×5 grid, one tile per column, left (rover at the
// crater edge) to right (ice site). Shadow tiles cost 2× battery and raise ice odds (card D5).
// Tile costs are a design choice from guide P2: lit 4%, shadow 8%, so routes cost 20–40%.
import type { Minigame, MinigameContext, Outcomes } from './types';
import { el, injectCss, makeFrame, button, onKeys } from './kit';
import { TILE_COST } from '../engine/rules';

const CSS = `
.rp-content{position:absolute;left:24px;right:24px;top:72px;bottom:24px;display:flex;gap:48px}
.rp-left{display:flex;flex-direction:column;gap:8px}
.rp-ends{display:flex;justify-content:space-between}
.rp-grid{display:grid;grid-template-columns:repeat(5,104px);grid-template-rows:repeat(5,104px);gap:8px}
.rp-tile{position:relative;display:flex;align-items:center;justify-content:center;padding:0;border:4px solid var(--ink);cursor:pointer;font-family:var(--font-label);font-size:24px}
.rp-tile.lit{background:var(--edge);color:var(--ink)}
.rp-tile.shadow{background:var(--panel-solid);color:var(--cyan)}
.rp-tile.ok{border-color:var(--text)}
.rp-tile.no{cursor:default;opacity:.55}
.rp-tile.on{border-color:var(--gold);box-shadow:inset 0 0 0 4px var(--gold)}
.rp-tile.cur{outline:4px solid var(--gold);outline-offset:4px}
.rp-tile .n{position:absolute;left:4px;top:0;color:var(--gold)}
.rp-right{flex:1;display:flex;flex-direction:column;gap:20px}
.rp-stat{font-size:32px}
.rp-bat{position:relative;height:56px;background:var(--ink);border:4px solid var(--edge)}
.rp-bat .out{position:absolute;top:0;bottom:0;left:0;background:var(--cyan)}
.rp-bat .back{position:absolute;top:0;bottom:0;background:var(--gold)}
.rp-bat .line{position:absolute;top:-12px;bottom:-12px;left:40%;border-left:4px dotted var(--text)}
.rp-scale{position:relative;height:32px}
.rp-scale span{position:absolute;transform:translateX(-50%)}
.rp-btns{display:flex;gap:16px;margin-top:auto}
.rp-legend{display:flex;gap:24px;align-items:center}
.rp-sw{display:inline-block;width:32px;height:32px;vertical-align:middle;margin-right:8px;border:4px solid var(--ink)}
`;

// Row 0 is all lit, row 4 all shadow, the middle rows mix, so every shadow count 0–5 is reachable.
const LAYOUT = ['LLLLL', 'LSLSL', 'SLSLS', 'SSLSS', 'SSSSS'];
const isShadow = (r: number, c: number) => LAYOUT[r][c] === 'S';

export const routePlanner: Minigame<'route_planner'> = {
  id: 'route_planner',
  run(ctx: MinigameContext) {
    injectCss('route-planner', CSS);
    return new Promise<Outcomes['route_planner']>((resolve) => {
      ctx.setRef('D5');
      const f = makeFrame(ctx, 'Route planner · Shackleton', 'Pick one tile per column, left to right. Arrows choose, Enter adds, Backspace undoes.', { top: 64, height: 840 });
      const content = el('div', 'rp-content', undefined, f.body);
      const left = el('div', 'rp-left', undefined, content);
      const ends = el('div', 'rp-ends', undefined, left);
      el('span', 'label muted', '◀ Rover', ends);
      el('span', 'label cyan', 'Ice site ▶', ends);
      const grid = el('div', 'rp-grid', undefined, left);
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', 'Route grid, 5 columns by 5 rows');
      const legend = el('div', 'rp-legend', undefined, left);
      const l1 = el('span', 'label', '', legend);
      el('span', 'rp-sw', undefined, l1).style.background = 'var(--edge)';
      l1.append(`Lit ${TILE_COST.lit}%`);
      const l2 = el('span', 'label cyan', '', legend);
      el('span', 'rp-sw', undefined, l2).style.background = 'var(--panel-solid)';
      l2.append(`Shadow ${TILE_COST.shadow}% · ice+`);

      const right = el('div', 'rp-right', undefined, content);
      const statOut = el('div', 'rp-stat', '', right);
      const statBack = el('div', 'rp-stat', '', right);
      const statLeft = el('div', 'rp-stat', '', right);
      const bat = el('div', 'rp-bat', undefined, right);
      bat.setAttribute('role', 'img');
      const outFill = el('div', 'out', undefined, bat);
      const backFill = el('div', 'back', undefined, bat);
      el('div', 'line', undefined, bat);
      const scale = el('div', 'rp-scale label muted', undefined, right);
      for (const p of [0, 40, 100]) {
        const s = el('span', p === 40 ? 'gold' : '', p === 40 ? '40% turn line' : `${p}%`, scale);
        s.style.left = p + '%';
        if (p === 0) s.style.transform = 'none';
        if (p === 100) s.style.transform = 'translateX(-100%)';
      }
      el('div', 'rp-stat muted', 'The way back costs the same as the way out.', right);
      const ice = el('div', 'label cyan', '', right);
      const btns = el('div', 'rp-btns', undefined, right);
      const undoB = button('Undo', () => undo(), btns, 'small');
      const clearB = button('Clear', () => clear(), btns, 'small');
      const goB = button('Drive this route', () => confirm(), btns, 'primary');

      const path: number[] = [];
      let cursor = 0;
      let done = false;

      const tiles: HTMLButtonElement[][] = [];
      for (let r = 0; r < 5; r++) {
        tiles.push([]);
        for (let c = 0; c < 5; c++) {
          const t = el('button', 'rp-tile ' + (isShadow(r, c) ? 'shadow' : 'lit'), undefined, grid);
          t.type = 'button';
          t.style.gridRow = String(r + 1);
          t.style.gridColumn = String(c + 1);
          t.textContent = isShadow(r, c) ? 'ice+' : '';
          t.addEventListener('click', (e) => {
            e.stopPropagation();
            add(r, c);
          });
          tiles[r].push(t);
        }
      }

      const allowed = (r: number) => {
        const c = path.length;
        if (c >= 5) return false;
        if (c === 0) return true;
        return Math.abs(r - path[c - 1]) <= 1;
      };
      const cost = () => path.reduce((s, r, c) => s + (isShadow(r, c) ? TILE_COST.shadow : TILE_COST.lit), 0);
      const shadows = () => path.filter((r, c) => isShadow(r, c)).length;

      function render() {
        const nextCol = path.length;
        if (nextCol < 5 && !allowed(cursor)) cursor = nextCol === 0 ? cursor : path[nextCol - 1];
        for (let r = 0; r < 5; r++)
          for (let c = 0; c < 5; c++) {
            const t = tiles[r][c];
            const on = path[c] === r;
            const ok = c === nextCol && allowed(r);
            t.classList.toggle('on', on);
            t.classList.toggle('ok', ok);
            t.classList.toggle('no', !on && !ok);
            t.classList.toggle('cur', c === nextCol && r === cursor);
            t.disabled = !ok;
            const kind = isShadow(r, c) ? `shadow, ${TILE_COST.shadow}%` : `lit, ${TILE_COST.lit}%`;
            t.setAttribute('aria-label', `Column ${c + 1}, row ${r + 1}: ${kind}${on ? ', on route' : ''}`);
            t.innerHTML = '';
            if (on) el('span', 'n', String(c + 1), t);
            if (isShadow(r, c)) el('span', '', 'ice+', t);
          }
        const out = cost();
        statOut.innerHTML = '';
        statOut.append('Way out: ');
        el('span', out > 40 ? 'red' : 'cyan', `${out}%`, statOut);
        statBack.innerHTML = '';
        statBack.append('Way back: ');
        el('span', 'gold', `${out}%`, statBack);
        statLeft.textContent = `Left at home: ${100 - 2 * out}%`;
        outFill.style.width = out + '%';
        backFill.style.left = out + '%';
        backFill.style.width = out + '%';
        bat.setAttribute('aria-label', `Battery: ${out}% out, ${out}% back, ${100 - 2 * out}% left`);
        const sh = shadows();
        ice.textContent = `Ice odds: ${sh <= 1 ? 'low' : sh <= 3 ? 'medium' : 'high'} (${sh} shadow tile${sh === 1 ? '' : 's'})`;
        f.right.textContent = `${path.length}/5`;
        undoB.disabled = clearB.disabled = path.length === 0;
        goB.disabled = path.length < 5;
        f.help.textContent =
          path.length < 5 ? `Column ${nextCol + 1}: pick a tile next to the last one. Arrows choose, Enter adds, Backspace undoes.` : 'Route set. Drive it, or undo to change it.';
      }

      function add(r: number, c: number) {
        if (done || c !== path.length || !allowed(r)) return;
        path.push(r);
        cursor = r;
        ctx.sfx('blip');
        render();
        if (path.length === 5) goB.focus();
      }
      function undo() {
        if (done || !path.length) return;
        cursor = path.pop()!;
        render();
      }
      function clear() {
        if (done) return;
        path.length = 0;
        render();
      }
      function confirm() {
        if (done || path.length < 5) return;
        done = true;
        removeKeys();
        ctx.sfx('success');
        ctx.setRef(null);
        ctx.root.innerHTML = '';
        resolve({ cost: cost(), shadow: shadows() });
      }

      const removeKeys = onKeys((e) => {
        if (done) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          if (path.length >= 5) return;
          const next = cursor + (e.key === 'ArrowUp' ? -1 : 1);
          if (next >= 0 && next < 5 && allowed(next)) cursor = next;
          render();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          undo();
        } else if (e.key === 'Enter') {
          const active = document.activeElement;
          if (active instanceof HTMLButtonElement && ctx.root.contains(active)) return;
          e.preventDefault();
          if (path.length < 5) add(cursor, path.length);
          else confirm();
        }
      });

      render();
    });
  },
};
