// Dose Log (scene 4.3): each crewmate's dose for this storm and career total, against NASA's lines (card D2).
import { LIMITS } from '../engine/rules';
import { button, el, injectCss, makeFrame, onKeys } from './kit';
import type { Minigame } from './types';

const CREW = ['YOU', 'AMARA', 'LUCIA', 'SIONE'];

const CSS = `
.dl-table { position: absolute; left: 24px; right: 24px; top: 80px; display: grid;
  grid-template-columns: 200px 1fr 1fr; gap: 16px 32px; align-items: center; }
.dl-head { color: var(--muted); }
.dl-name { color: var(--gold); }
.dl-cell { display: flex; flex-direction: column; gap: 8px; }
.dl-val { font-size: 32px; }
.dl-bar { position: relative; height: 32px; background: var(--ink); border: 4px solid var(--edge); }
.dl-bar .fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--green); }
.dl-bar .fill.over { background: var(--red); }
.dl-bar .mark { position: absolute; top: -12px; bottom: -12px; width: 4px; background: var(--red); }
.dl-bar .mark span { position: absolute; top: -28px; left: -24px; font-family: var(--font-label); font-size: 24px;
  color: var(--red); white-space: nowrap; line-height: 1; }
.dl-note { position: absolute; left: 24px; right: 24px; bottom: 120px; font-size: 28px; color: var(--amber); }
.dl-actions { position: absolute; right: 24px; bottom: 16px; }
`;

function bar(parent: HTMLElement, value: number, limit: number, scaleMax: number, label: string) {
  const b = el('div', 'dl-bar', undefined, parent);
  b.setAttribute('role', 'img');
  b.setAttribute('aria-label', `${value} of ${limit} millisieverts ${label}`);
  const fill = el('div', 'fill' + (value >= limit ? ' over' : ''), undefined, b);
  fill.style.width = Math.min(100, (value / scaleMax) * 100) + '%';
  const mark = el('div', 'mark', undefined, b);
  mark.style.left = (limit / scaleMax) * 100 + '%';
  el('span', '', String(limit), mark);
}

export const doseLog: Minigame<'dose_log'> = {
  id: 'dose_log',
  run(ctx) {
    injectCss('dose-log', CSS);
    return new Promise((resolve) => {
      const storm = Number(ctx.vars.STORM ?? 0);
      const dose = storm === 0 ? 0 : Number(ctx.vars.DOSE ?? 0);
      const career = Number(ctx.vars.CAREER ?? 0);
      ctx.setRef('D2');
      const f = makeFrame(ctx, 'Dose Log · badges', 'Each badge reading, in millisieverts (mSv). Red lines are NASA limits.');
      const t = el('div', 'dl-table', undefined, f.body);
      t.setAttribute('role', 'table');
      el('div', 'label dl-head', 'Crew', t);
      el('div', 'label dl-head', `This storm · limit ${LIMITS.doseEvent}`, t);
      el('div', 'label dl-head', `Career · limit ${LIMITS.doseCareer}`, t);
      const stormMax = Math.max(300, dose * 1.1);
      const careerMax = Math.max(700, career * 1.1);
      for (const who of CREW) {
        el('div', 'label dl-name', who, t);
        const c1 = el('div', 'dl-cell', undefined, t);
        el('div', 'dl-val', `${dose} mSv`, c1);
        bar(c1, dose, LIMITS.doseEvent, stormMax, 'this storm');
        const c2 = el('div', 'dl-cell', undefined, t);
        el('div', 'dl-val', `${career} mSv`, c2);
        bar(c2, career, LIMITS.doseCareer, careerMax, 'career');
      }
      if (storm === 0) el('div', 'dl-note', 'Drill only: no particles reached the Moon.', f.body);
      else if (dose >= LIMITS.doseEvent) el('div', 'dl-note', 'Over the one-storm limit.', f.body);
      const actions = el('div', 'dl-actions', undefined, f.body);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        offKeys();
        ctx.sfx('blip');
        ctx.root.innerHTML = '';
        ctx.setRef(null);
        resolve({});
      };
      const cont = button('Continue', finish, actions, 'primary');
      const offKeys = onKeys((e) => {
        if ((e.key === 'Enter' || e.key === ' ') && document.activeElement !== cont) {
          e.preventDefault();
          finish();
        }
      });
      cont.focus();
    });
  },
};
