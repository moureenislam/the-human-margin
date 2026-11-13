// Asset lookup with drawn placeholders. If a PNG from human_margin_assets.zip is missing,
// the game draws a stand-in instead of a broken image, so it stays playable before the art lands.
import assets from '../data/assets.json';
import { placeholderBg, placeholderSprite } from './placeholders';

type BgEntry = { file: string; name: string; smooth?: boolean };
const BG = assets.bg as Record<string, BgEntry>;
const SPRITE_CODES = assets.sprites as Record<string, string>;
const SPRITE_FILES = assets.spriteFiles as Record<string, { file: string; who: string; suit: boolean }>;

export const SPRITE_W = 540;
export const SPRITE_H = 909;

export function hasBg(code: string) {
  return code in BG;
}
export function hasSprite(code: string) {
  return code in SPRITE_CODES;
}
export function bgInfo(code: string): BgEntry {
  const e = BG[code];
  if (!e) throw new Error('unknown background ' + code);
  return e;
}
export function spriteFileKey(code: string): string {
  const k = SPRITE_CODES[code];
  if (!k) throw new Error('unknown sprite ' + code);
  return k;
}
export function spriteWho(code: string): string {
  return SPRITE_FILES[spriteFileKey(code)].who;
}

const failed = new Set<string>();

/** Sets img.src to the file, swapping to a drawn placeholder if it fails to load. */
function loadInto(img: HTMLImageElement, file: string, fallback: () => string) {
  if (failed.has(file)) {
    img.src = fallback();
    return;
  }
  img.onerror = () => {
    failed.add(file);
    img.onerror = null;
    img.src = fallback();
  };
  img.src = file;
}

export function bgImage(code: string): HTMLImageElement {
  const info = bgInfo(code);
  const img = new Image(1920, 1080);
  img.alt = '';
  img.draggable = false;
  img.className = info.smooth ? '' : 'pixelated';
  loadInto(img, info.file, () => placeholderBg(code));
  return img;
}

export function spriteImage(code: string): HTMLImageElement {
  const key = spriteFileKey(code);
  const f = SPRITE_FILES[key];
  const img = new Image(SPRITE_W, SPRITE_H);
  img.alt = '';
  img.draggable = false;
  img.className = 'pixelated';
  loadInto(img, f.file, () => placeholderSprite(key, f.who, f.suit));
  return img;
}

/** A framed head crop of a sprite (radio insets, Shelter Drill portraits). */
export function headCrop(code: string, size: number): HTMLElement {
  const c = assets.headCrop;
  const wrap = document.createElement('div');
  wrap.className = 'headcrop';
  wrap.style.width = wrap.style.height = size + 'px';
  const img = spriteImage(code);
  const scale = size / c.w;
  img.style.width = SPRITE_W * scale + 'px';
  img.style.height = SPRITE_H * scale + 'px';
  img.style.left = -c.x * scale + 'px';
  img.style.top = -c.y * scale + 'px';
  wrap.appendChild(img);
  return wrap;
}

/** Preloads every image (so scene changes don't flash). Missing files are noted, not errors. */
export function preloadAll(): Promise<void> {
  const files = [...Object.values(BG).map((b) => b.file), ...Object.values(SPRITE_FILES).map((s) => s.file)];
  return Promise.all(
    files.map(
      (f) =>
        new Promise<void>((res) => {
          const i = new Image();
          i.onload = () => res();
          i.onerror = () => {
            failed.add(f);
            res();
          };
          i.src = f;
        }),
    ),
  ).then(() => undefined);
}

export function missingAssets(): string[] {
  return [...failed];
}
