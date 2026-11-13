// Shelter Drill (1.3; 4.3 "faster"). Rule R12 timing: perfect within 10 s (7 s fast) → 0.5,
// late within 20 s (14 s fast) → 0.8, not done or skipped → 1.0. Outcome is in tenths.
import type { Minigame, MinigameContext, Outcomes } from './types';
import { el, injectCss, makeFrame, button, makeDraggable, stageRect, inside, onKeys, wait, portrait } from './kit';

const CSS = `
.sd-content{position:absolute;left:24px;right:24px;top:72px;bottom:24px;display:flex;flex-direction:column;gap:24px}
.sd-top{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.sd-col{display:flex;flex-direction:column;gap:8px}
.sd-box{display:flex;gap:16px;align-items:center;min-height:212px;padding:16px;background:var(--ink);border:4px solid var(--edge)}
.sd-box.sd-shelter{border-style:dashed;border-color:var(--green)}
.sd-person{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px;background:var(--panel-solid);border:4px solid var(--edge);cursor:grab;color:var(--text)}
.sd-person:focus-visible,.sd-person:hover{border-color:var(--gold);outline:none}
.sd-person.in{border-color:var(--green);cursor:default}
.sd-systems{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.sd-sys{flex-direction:column;gap:4px;min-height:96px}
.sd-sys .sd-state{font-size:24px}
.sd-sys.off{background:var(--ink);border-color:var(--muted);color:var(--muted)}
.sd-time{position:relative;height:48px;background:var(--ink);border:4px solid var(--edge)}
.sd-time .fill{position:absolute;left:0;top:0;bottom:0;background:var(--green)}
.sd-time.amber .fill{background:var(--amber)}
.sd-time .mark{position:absolute;top:-4px;bottom:-4px;left:50%;width:4px;background:var(--gold)}
.sd-result{font-size:32px}
`;

type Who = 'YOU' | 'AMARA' | 'LUCIA' | 'SIONE';
const CREW: Who[] = ['YOU', 'AMARA', 'LUCIA', 'SIONE'];
const SYSTEMS: Array<{ name: string; essential: boolean }> = [
  { name: 'Scrubbers', essential: true },
  { name: 'Lab', essential: false },
  { name: 'Heaters', essential: true },
  { name: 'Lights', essential: false },
  { name: 'Comms', essential: true },
  { name: 'Rover', essential: false },
];

export const shelterDrill: Minigame<'shelter_drill'> = {
  id: 'shelter_drill',
  run(ctx: MinigameContext) {
    injectCss('shelter-drill', CSS);
    const fast = !!ctx.params.fast;
    const perfectMs = fast ? 7000 : 10000;
    const lateMs = fast ? 14000 : 20000;

    return new Promise<Outcomes['shelter_drill']>((resolve) => {
      const f = makeFrame(ctx, fast ? 'Shelter drill · faster' : 'Shelter drill', 'Get everyone into the shelter: tap each crewmate (or press 1–4).', { top: 64, height: 840 });
      const content = el('div', 'sd-content', undefined, f.body);
      const top = el('div', 'sd-top', undefined, content);
      const left = el('div', 'sd-col', undefined, top);
      el('div', 'label muted', 'Crew outside', left);
      const crewBox = el('div', 'sd-box', undefined, left);
      const right = el('div', 'sd-col', undefined, top);
      el('div', 'label green', 'Storm shelter', right);
      const shelter = el('div', 'sd-box sd-shelter', undefined, right);
      shelter.setAttribute('aria-label', 'Storm shelter');

      const sysWrap = el('div', 'sd-col', undefined, content);
      el('div', 'label muted', 'Switch off 3 systems you don’t need in a storm', sysWrap);
      const sysGrid = el('div', 'sd-systems', undefined, sysWrap);

      const timeWrap = el('div', 'sd-col', undefined, content);
      const timeLabel = el('div', 'label', '', timeWrap);
      const timeBar = el('div', 'sd-time', undefined, timeWrap);
      const fill = el('div', 'fill', undefined, timeBar);
      el('div', 'mark', undefined, timeBar);
      timeBar.setAttribute('role', 'progressbar');
      timeBar.setAttribute('aria-label', 'Time before the particles arrive');

      const cleanups: Array<() => void> = [];
      let done = false;
      let elapsed = 0;
      const sheltered = new Set<Who>();
      let offCount = 0;
      const sysButtons: HTMLButtonElement[] = [];

      const skip = button('Skip drill', () => finish(10), f.right, 'small');
      skip.setAttribute('aria-label', 'Skip the drill');

      const people = CREW.map((who, i) => {
        const b = el('button', 'sd-person', undefined, crewBox);
        b.type = 'button';
        b.setAttribute('aria-label', `${i + 1}: move ${who === 'YOU' ? 'yourself' : who} into the shelter`);
        b.appendChild(portrait(who, 128));
        el('span', 'label', `${i + 1} ${who}`, b);
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          moveIn(who, b);
        });
        cleanups.push(
          makeDraggable(b, {
            onDrop: (pt) => {
              if (inside(pt, stageRect(shelter))) moveIn(who, b);
              return false;
            },
          }),
        );
        return b;
      });

      for (const s of SYSTEMS) {
        const b = button('', () => toggle(s, b), sysGrid, 'sd-sys');
        b.disabled = true;
        b.textContent = '';
        el('span', '', s.name, b);
        const st = el('span', 'sd-state green', 'ON', b);
        b.setAttribute('aria-label', `Switch off ${s.name}`);
        (b as any)._state = st;
        b.addEventListener('animationend', () => b.classList.remove('shake'));
        sysButtons.push(b);
      }

      function moveIn(who: Who, b: HTMLButtonElement) {
        if (done || sheltered.has(who)) return;
        sheltered.add(who);
        b.classList.add('in');
        b.disabled = true;
        shelter.appendChild(b);
        ctx.sfx('blip');
        if (sheltered.size === CREW.length) {
          f.help.textContent = 'Everyone’s in. Now switch off 3 systems you don’t need in a storm.';
          sysButtons.forEach((s) => (s.disabled = false));
          sysButtons[0].focus();
        }
        check();
      }

      function toggle(s: { name: string; essential: boolean }, b: HTMLButtonElement) {
        if (done || b.classList.contains('off')) return;
        if (s.essential) {
          b.classList.remove('shake');
          void b.offsetWidth;
          b.classList.add('shake');
          ctx.sfx('thud');
          f.help.textContent = `Keep ${s.name} on. We need it in a storm.`;
          return;
        }
        b.classList.add('off');
        (b as any)._state.textContent = 'OFF';
        (b as any)._state.className = 'sd-state muted';
        b.setAttribute('aria-label', `${s.name} is off`);
        offCount++;
        ctx.sfx('blip');
        f.help.textContent = offCount < 3 ? `${3 - offCount} more to switch off.` : 'Done.';
        check();
      }

      function check() {
        if (sheltered.size === CREW.length && offCount >= 3) finish(elapsed <= perfectMs ? 5 : elapsed <= lateMs ? 8 : 10);
      }

      cleanups.push(
        onKeys((e) => {
          const n = Number(e.key);
          if (n >= 1 && n <= 4) {
            e.preventDefault();
            moveIn(CREW[n - 1], people[n - 1]);
          }
        }),
      );

      const stopFrame = ctx.onFrame((dt) => {
        if (done) return;
        elapsed += dt;
        const remain = Math.max(0, lateMs - elapsed);
        fill.style.width = (remain / lateMs) * 100 + '%';
        timeBar.setAttribute('aria-valuenow', String(Math.ceil(remain / 1000)));
        if (elapsed <= perfectMs) {
          timeLabel.className = 'label green';
          timeLabel.textContent = `Perfect window: ${((perfectMs - elapsed) / 1000).toFixed(1)} s`;
          timeBar.classList.remove('amber');
        } else {
          timeLabel.className = 'label amber';
          timeLabel.textContent = `Late: ${(remain / 1000).toFixed(1)} s before the particles arrive`;
          timeBar.classList.add('amber');
        }
        if (elapsed >= lateMs) finish(10);
      });
      cleanups.push(stopFrame);

      async function finish(drill: 5 | 8 | 10) {
        if (done) return;
        done = true;
        cleanups.forEach((c) => c());
        skip.disabled = true;
        sysButtons.forEach((s) => (s.disabled = true));
        people.forEach((p) => (p.disabled = true));
        const msg = drill === 5 ? 'Everyone’s in. Perfect drill.' : drill === 8 ? 'Everyone’s in, a little late.' : 'Too slow. The particles caught us outside.';
        f.help.textContent = msg;
        f.help.className = 'mg-help sd-result ' + (drill === 5 ? 'green' : drill === 8 ? 'amber' : 'red');
        ctx.sfx(drill === 10 ? 'fail' : 'success');
        await wait(ctx, 1200);
        ctx.root.innerHTML = '';
        resolve({ drill });
      }

      people[0].focus();
    });
  },
};
