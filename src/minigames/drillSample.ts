// Drill Sample (3.2). Hold to drill, release when the heat gauge peaks.
// Perfect: clean ice sample. Early: small sample. Late: dust only, BATTERY −2 (applied in ink).
// The peak window is about 0.4 s wide (design choice, guide section 8).
import type { Minigame, MinigameContext, Outcomes } from './types';
import { el, injectCss, makeFrame, wait } from './kit';

const WINDOW_START = 1900; // ms held
const WINDOW_END = 2300;
const OVERHEAT = 2700;

const CSS = `
.ds-content{position:absolute;left:24px;right:24px;top:72px;bottom:24px;display:flex;gap:96px;align-items:center;justify-content:center}
.ds-gauge-wrap{display:flex;flex-direction:column;align-items:center;gap:12px}
.ds-gauge{position:relative;width:128px;height:520px;background:var(--ink);border:4px solid var(--edge)}
.ds-gauge .win{position:absolute;left:0;right:0;background:var(--green);opacity:.35}
.ds-gauge .winedge{position:absolute;left:-16px;right:-16px;height:4px;background:var(--green)}
.ds-gauge .fill{position:absolute;left:8px;right:8px;bottom:8px;background:var(--amber)}
.ds-gauge .fill.hot{background:var(--red)}
.ds-gauge .fill.ok{background:var(--green)}
.ds-side{display:flex;flex-direction:column;gap:32px;align-items:flex-start;max-width:720px}
.ds-hold{width:480px;min-height:192px;font-size:32px}
.ds-hold.down{background:var(--panel-light);border-color:var(--gold);transform:translateY(4px)}
.ds-msg{font-size:32px;min-height:96px}
`;

export const drillSample: Minigame<'drill_sample'> = {
  id: 'drill_sample',
  run(ctx: MinigameContext) {
    injectCss('drill-sample', CSS);
    return new Promise<Outcomes['drill_sample']>((resolve) => {
      const f = makeFrame(ctx, 'Drill sample', 'Hold to drill (mouse, touch, Space or Enter). Let go when the heat is in the green band.', { top: 64, height: 840 });
      const content = el('div', 'ds-content', undefined, f.body);
      const gw = el('div', 'ds-gauge-wrap', undefined, content);
      el('div', 'label', 'Drill heat', gw);
      const gauge = el('div', 'ds-gauge', undefined, gw);
      gauge.setAttribute('role', 'progressbar');
      gauge.setAttribute('aria-label', 'Drill heat');
      const pct = (ms: number) => (ms / OVERHEAT) * 100;
      const win = el('div', 'win', undefined, gauge);
      win.style.bottom = pct(WINDOW_START) + '%';
      win.style.height = pct(WINDOW_END) - pct(WINDOW_START) + '%';
      for (const ms of [WINDOW_START, WINDOW_END]) el('div', 'winedge', undefined, gauge).style.bottom = pct(ms) + '%';
      const fill = el('div', 'fill', undefined, gauge);
      fill.style.height = '0';
      el('div', 'label green', 'Peak', gw);

      const side = el('div', 'ds-side', undefined, content);
      const hold = el('button', 'px-btn ds-hold primary', 'Hold to drill', side);
      hold.type = 'button';
      hold.setAttribute('aria-label', 'Hold to drill. Release in the green band.');
      const msg = el('div', 'ds-msg', '', side);
      msg.setAttribute('aria-live', 'assertive');

      let phase: 'idle' | 'holding' | 'done' = 'idle';
      let held = 0;
      let t = 0;

      const start = () => {
        if (phase !== 'idle') return;
        phase = 'holding';
        hold.classList.add('down');
        ctx.sfx('blip');
      };
      const release = () => {
        if (phase !== 'holding') return;
        const q: Outcomes['drill_sample']['quality'] = held < WINDOW_START ? 'early' : held <= WINDOW_END ? 'perfect' : 'late';
        finish(q);
      };

      const down = (e: PointerEvent) => {
        e.preventDefault();
        hold.setPointerCapture(e.pointerId);
        start();
      };
      const up = () => release();
      hold.addEventListener('pointerdown', down);
      hold.addEventListener('pointerup', up);
      hold.addEventListener('pointercancel', up);
      hold.addEventListener('click', (e) => e.stopPropagation());

      const isKey = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
      const kd = (e: KeyboardEvent) => {
        if (!isKey(e) || document.body.classList.contains('paused')) return;
        e.preventDefault();
        if (!e.repeat) start();
      };
      // Releases count even while paused: the clock is frozen, so the judged time is fair.
      const ku = (e: KeyboardEvent) => {
        if (!isKey(e)) return;
        e.preventDefault();
        release();
      };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);

      const stopFrame = ctx.onFrame((dt) => {
        t += dt;
        if (phase !== 'holding') return;
        held += dt;
        const wobble = ctx.reduceMotion ? 0 : Math.sin(t / 45) * 1.2;
        const h = Math.min(100, Math.max(0, pct(held) + wobble));
        fill.style.height = `calc(${h}% - 16px)`;
        fill.classList.toggle('ok', held >= WINDOW_START && held <= WINDOW_END);
        fill.classList.toggle('hot', held > WINDOW_END);
        gauge.setAttribute('aria-valuenow', String(Math.round(h)));
        if (held >= WINDOW_START - 400 && held < WINDOW_START) f.help.textContent = 'Almost…';
        if (held >= WINDOW_START && held <= WINDOW_END) f.help.textContent = 'Now!';
        if (held > WINDOW_END) f.help.textContent = 'Too hot!';
        if (held >= OVERHEAT) finish('late');
      });

      function cleanup() {
        stopFrame();
        hold.removeEventListener('pointerdown', down);
        hold.removeEventListener('pointerup', up);
        hold.removeEventListener('pointercancel', up);
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
      }

      async function finish(q: Outcomes['drill_sample']['quality']) {
        if (phase === 'done') return;
        phase = 'done';
        cleanup();
        hold.classList.remove('down');
        hold.disabled = true;
        if (q === 'perfect') {
          msg.textContent = 'Perfect. A clean ice sample.';
          msg.className = 'ds-msg green';
          ctx.sfx('success');
        } else if (q === 'early') {
          msg.textContent = 'Too early. A small sample.';
          msg.className = 'ds-msg amber';
          ctx.sfx('blip');
        } else {
          msg.textContent = 'Overheated. Dust only. BATTERY −2';
          msg.className = 'ds-msg red';
          ctx.sfx('fail');
        }
        f.help.textContent = '';
        await wait(ctx, 1200);
        ctx.root.innerHTML = '';
        resolve({ quality: q });
      }

      hold.focus();
    });
  },
};
