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
    // Work in device pixels, so high-DPI screens and browser zoom are handled too.
    const dpr = window.devicePixelRatio || 1;
    const fitDev = s * dpr;
    let dev = fitDev;
    // Whole-number scales keep every art pixel the same size, but only when they don't
    // leave big borders (e.g. 2560×1440 would shrink to 1× with 25% black on each side).
    if (fitDev >= 1) {
      const whole = Math.floor(fitDev);
      if (whole / fitDev >= 0.85) dev = whole;
    }
    s = dev / dpr;
    // Shrinking with nearest-neighbour drops whole rows of pixels and breaks outlines,
    // so below one art pixel per device pixel the art is scaled smoothly instead.
    document.body.classList.toggle('downscaled', dev < 0.999);
    const x = Math.round(((w - 1920 * s) / 2) * dpr) / dpr;
    const y = Math.round(((h - 1080 * s) / 2) * dpr) / dpr;
    // CSS zoom (not a scale transform): the browser lays out and draws text and art at the
    // final size, which resamples far better when shrinking. The stage's own left/top are
    // zoomed too, so they are divided by s.
    stage.style.zoom = String(s);
    stage.style.left = x / s + 'px';
    stage.style.top = y / s + 'px';
  };
  window.addEventListener('resize', fit);
  // Browser zoom and moving between monitors change devicePixelRatio.
  const watchDpr = () => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener('change', () => {
      fit();
      watchDpr();
    }, { once: true });
  };
  watchDpr();
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
