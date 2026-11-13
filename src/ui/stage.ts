// 1920×1080 stage, scaled to the window and letterboxed in the darkest navy.
// Whole-number scales when the window allows (1× at 1080p, 2× at 4K).
export const LAYERS = ['bg', 'sprites', 'insets', 'hud', 'dialogue', 'choices', 'minigame', 'cards', 'overlay', 'menus', 'toast'] as const;
export type LayerName = (typeof LAYERS)[number];

export interface StageRefs {
  stage: HTMLElement;
  layer: Record<LayerName, HTMLElement>;
  live: HTMLElement; // aria-live region for dialogue text
}

export function setupStage(): StageRefs {
  const viewport = document.getElementById('viewport')!;
  const stage = document.getElementById('stage')!;
  const layer = {} as Record<LayerName, HTMLElement>;
  for (const name of LAYERS) {
    const d = document.createElement('div');
    d.id = 'l-' + name;
    d.className = 'layer';
    stage.appendChild(d);
    layer[name] = d;
  }
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'log');
  document.body.appendChild(live);

  const fit = () => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    let s = Math.min(w / 1920, h / 1080);
    if (s >= 1) s = Math.floor(s);
    const x = Math.round((w - 1920 * s) / 2);
    const y = Math.round((h - 1080 * s) / 2);
    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  };
  window.addEventListener('resize', fit);
  fit();
  return { stage, layer, live };
}

export function toast(layer: HTMLElement, text: string, ms = 1600) {
  const t = document.createElement('div');
  t.className = 'toast px solid';
  t.textContent = text;
  layer.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
