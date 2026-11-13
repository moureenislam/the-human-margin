// Choice screen: each button shows its cost line (core rule 1), unaffordable buttons are greyed
// out with "not enough Power", and risky options carry a tappable ECHO tag (core rule 4).
import type { ChoiceMeta } from '../engine/tags';
import { audio } from '../engine/audio';
import { pushKeys } from './input';
import refs from '../data/refs.json';
import type { StageRefs } from './stage';

export interface ChoiceItem {
  text: string;
  meta: ChoiceMeta;
  enabled: boolean;
}

function costLine(fx: string, parent: HTMLElement) {
  for (const part of fx.split(/,\s*/)) {
    const s = document.createElement('span');
    s.textContent = part;
    if (/[−-]\s*\d|^Uses /.test(part)) s.className = 'spend';
    else if (/\+\s*\d/.test(part)) s.className = 'gain';
    parent.appendChild(s);
  }
}

export function showChoices(r: StageRefs, items: ChoiceItem[], warn: 'amber' | 'red' | null): Promise<number> {
  return new Promise((resolve) => {
    const layer = r.layer.choices;
    layer.replaceChildren();
    const dim = document.createElement('div');
    dim.className = 'choices-dim';
    const wrap = document.createElement('div');
    wrap.className = 'choices';
    wrap.setAttribute('role', 'group');
    const title = items.find((i) => i.meta.title)?.meta.title ?? 'Decide';
    const head = document.createElement('div');
    head.className = 'head px solid' + (warn ? ' ' + warn : '');
    const ht = document.createElement('span');
    ht.textContent = warn === 'red' ? 'ALARM · RED' : warn === 'amber' ? 'WARNING · AMBER' : title;
    const hr = document.createElement('span');
    hr.textContent = warn ? title : 'You hold the cubes';
    hr.className = 'muted';
    head.append(ht, hr);
    wrap.appendChild(head);
    wrap.setAttribute('aria-label', ht.textContent!);
    let tagline: HTMLElement | null = null;
    const buttons: HTMLElement[] = [];
    let focus = items.findIndex((i) => i.enabled);

    const choose = (i: number) => {
      if (!items[i]?.enabled) {
        audio.sfx('thud');
        return;
      }
      audio.unlock();
      audio.sfx('blip');
      unkeys();
      layer.replaceChildren();
      resolve(i);
    };
    const setFocus = (i: number) => {
      focus = i;
      buttons.forEach((b, k) => b.classList.toggle('focused', k === i));
      buttons[i]?.focus({ preventScroll: true });
    };

    items.forEach((item, i) => {
      const b = document.createElement('div');
      b.className = 'choice px solid' + (item.enabled ? '' : ' disabled');
      b.tabIndex = 0;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-disabled', String(!item.enabled));
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = String(i + 1);
      const txt = document.createElement('div');
      txt.className = 'txt';
      txt.textContent = item.text;
      const cost = document.createElement('div');
      cost.className = 'cost';
      costLine(item.meta.fx ?? '', cost);
      if (!item.enabled) {
        const n = document.createElement('span');
        n.className = 'spend';
        n.textContent = '· not enough Power';
        cost.appendChild(n);
      }
      if (item.meta.echoTag) {
        const tag = document.createElement('button');
        tag.type = 'button';
        tag.className = 'echotag';
        const mission = ((refs as any)[item.meta.echoTag.id]?.label ?? item.meta.echoTag.id).replace(/,.*$/, '');
        tag.textContent = 'ECHO · ' + mission;
        tag.setAttribute('aria-label', `History Echo: ${mission}. Show the tag line without choosing.`);
        tag.addEventListener('click', (e) => {
          e.stopPropagation();
          audio.sfx('blip');
          tagline?.remove();
          tagline = document.createElement('div');
          tagline.className = 'tagline px solid';
          tagline.setAttribute('role', 'status');
          tagline.textContent = item.meta.echoTag!.line || mission;
          layer.appendChild(tagline);
        });
        cost.appendChild(tag);
      }
      b.append(key, txt, cost);
      b.addEventListener('click', () => choose(i));
      b.addEventListener('mouseenter', () => item.enabled && setFocus(i));
      wrap.appendChild(b);
      buttons.push(b);
    });
    layer.append(dim, wrap);
    if (focus >= 0) buttons[focus].classList.add('focused');

    const unkeys = pushKeys((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= items.length) {
        choose(n - 1);
        return true;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const d = e.key === 'ArrowDown' ? 1 : -1;
        let k = focus;
        for (let step = 0; step < items.length; step++) {
          k = (k + d + items.length) % items.length;
          if (items[k].enabled) break;
        }
        setFocus(k);
        return true;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (document.activeElement?.classList.contains('echotag')) return false;
        if (focus >= 0) choose(focus);
        return true;
      }
      return false;
    });
  });
}
