// Drawn stand-ins for missing art: low-res canvas pixel art, scaled up pixelated by the stage.
// Backgrounds are 240×135 (8× = 1920×1080); sprites 90×152 (6× ≈ 540×909), transparent.
// Deterministic (seeded PRNG) so screenshots and tests are stable. Each carries a corner code label.
const cache = new Map<string, string>();

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type G = CanvasRenderingContext2D;
function canvas(w: number, h: number): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}
const R = (g: G, c: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
function disc(g: G, c: string, cx: number, cy: number, r: number) {
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    R(g, c, cx - w, cy + y, w * 2 + 1, 1);
  }
}
function label(g: G, text: string, x: number, y: number) {
  g.font = '6px monospace';
  const w = Math.ceil(g.measureText(text).width) + 4;
  R(g, 'rgba(11,15,26,0.85)', x, y, w, 9);
  g.fillStyle = '#d9a441';
  g.textBaseline = 'top';
  g.fillText(text, x + 2, y + 1);
}
function stars(g: G, rand: () => number, n: number, w: number, h: number) {
  for (let i = 0; i < n; i++) R(g, rand() < 0.2 ? '#ede6d3' : '#8fa3b8', rand() * w, rand() * h, 1, 1);
}
function ground(g: G, rand: () => number, y0: number, base: string, dark: string, light: string) {
  R(g, base, 0, y0, 240, 135 - y0);
  for (let i = 0; i < 260; i++) R(g, rand() < 0.5 ? dark : light, rand() * 240, y0 + rand() * (135 - y0), 1 + rand() * 3, 1);
  for (let i = 0; i < 8; i++) {
    const x = rand() * 240, y = y0 + 8 + rand() * (120 - y0), r = 2 + rand() * 5;
    R(g, dark, x - r, y, r * 2, 1 + r / 3);
    R(g, light, x - r, y + 1 + r / 3, r * 2, 1);
  }
}
function earth(g: G, cx: number, cy: number, r: number) {
  disc(g, '#2f6fb0', cx, cy, r);
  disc(g, '#4c9a52', cx - r / 3, cy - r / 4, r / 3);
  disc(g, '#4c9a52', cx + r / 3, cy + r / 3, r / 4);
  R(g, '#ede6d3', cx - r / 2, cy - r + 1, r, 1);
}
function habitatInterior(g: G, rand: () => number, red: boolean) {
  const wall = red ? '#3a1416' : '#7d7466', mid = red ? '#2a0e10' : '#5f584d', lite = red ? '#6a2224' : '#a39a88';
  R(g, wall, 0, 0, 240, 135);
  for (let x = 0; x < 240; x += 24) {
    R(g, mid, x, 0, 1, 104);
    for (let y = 8; y < 100; y += 22) R(g, lite, x + 3, y, 18, 1);
  }
  disc(g, mid, 120, 46, 26);
  disc(g, red ? '#100406' : '#0b0f1a', 120, 46, 21);
  stars(g, rand, 12, 0, 0);
  for (let i = 0; i < 10; i++) R(g, '#ede6d3', 104 + rand() * 32, 30 + rand() * 32, 1, 1);
  R(g, mid, 0, 104, 240, 31);
  for (let x = 0; x < 240; x += 12) R(g, lite, x, 104, 6, 1);
  for (let i = 0; i < 4; i++) {
    const x = 12 + i * 58;
    R(g, mid, x, 70, 34, 34);
    R(g, red ? '#e05a4f' : '#5cc8d6', x + 4, 76, 26, 10);
    R(g, red ? '#e3a33b' : '#7bc67e', x + 4, 90, 4, 3);
  }
  if (red) for (let x = 0; x < 240; x += 40) R(g, '#e05a4f', x + 10, 2, 20, 3);
}

function drawBg(code: string, g: G) {
  const rand = rng(hash(code));
  switch (code) {
    case 'BG01': {
      R(g, '#141a2e', 0, 0, 240, 135);
      R(g, '#0b0f1a', 60, 10, 110, 60);
      R(g, '#1c2a4a', 64, 14, 102, 52);
      stars(g, rand, 30, 0, 0);
      for (let i = 0; i < 30; i++) R(g, '#ede6d3', 64 + rand() * 102, 14 + rand() * 30, 1, 1);
      for (let x = 64; x < 166; x += 6) {
        const h = 8 + rand() * 16;
        R(g, '#0b0f1a', x, 66 - h, 6, h);
        if (rand() < 0.6) R(g, '#d9a441', x + 2, 66 - h + 3, 1, 1);
      }
      R(g, '#2b3a50', 112, 10, 4, 60);
      R(g, '#2b3a50', 60, 38, 110, 3);
      R(g, '#2b3a50', 10, 80, 70, 40);
      R(g, '#3d4f6c', 10, 76, 70, 8);
      R(g, '#5a4a3a', 170, 66, 70, 6);
      R(g, '#3a2e24', 176, 72, 4, 63);
      R(g, '#3a2e24', 232, 72, 4, 63);
      R(g, '#8fa3b8', 186, 54, 14, 10);
      R(g, '#5cc8d6', 188, 56, 10, 6);
      // Gold-visored figurine on the desk (≈ x 210–219, y 48–66).
      R(g, '#ede6d3', 212, 52, 6, 6);
      R(g, '#d9a441', 213, 53, 4, 3);
      R(g, '#ede6d3', 211, 58, 8, 6);
      R(g, '#ede6d3', 212, 64, 2, 2);
      R(g, '#ede6d3', 216, 64, 2, 2);
      R(g, '#8fa3b8', 34, 30, 4, 46);
      R(g, '#8fa3b8', 26, 26, 16, 6);
      break;
    }
    case 'BG02': {
      R(g, '#05070d', 0, 0, 240, 135);
      stars(g, rand, 50, 240, 70);
      ground(g, rand, 72, '#7c7f86', '#5d6068', '#a2a5ab');
      for (const [x, w] of [[40, 34], [86, 24]] as const) {
        R(g, '#c9c6bd', x, 70 - w / 3, w, w / 3 + 8);
        R(g, '#ede6d3', x + 2, 70 - w / 3, w - 4, 2);
        R(g, '#5cc8d6', x + w / 2 - 2, 72, 4, 3);
      }
      for (let i = 0; i < 4; i++) {
        R(g, '#8fa3b8', 160 + i * 18, 40, 1, 32);
        R(g, '#1c3a6a', 152 + i * 18, 26 + (i % 2) * 2, 16, 12);
        R(g, '#2f5a9a', 153 + i * 18, 27 + (i % 2) * 2, 14, 1);
      }
      break;
    }
    case 'BG03':
      habitatInterior(g, rand, false);
      break;
    case 'BG03R':
      habitatInterior(g, rand, true);
      break;
    case 'BG04': {
      R(g, '#1d2b2a', 0, 0, 240, 135);
      for (let x = 10; x < 240; x += 56) {
        R(g, '#8fa3b8', x, 6, 2, 110);
        R(g, '#8fa3b8', x + 44, 6, 2, 110);
        for (let y = 20; y < 110; y += 26) {
          R(g, '#e3a33b', x + 2, y - 6, 42, 1);
          R(g, '#5f584d', x + 2, y + 10, 42, 3);
          for (let k = 0; k < 9; k++) {
            const px = x + 4 + k * 4.5, ph = 3 + rand() * 6;
            R(g, rand() < 0.5 ? '#4c9a52' : '#7bc67e', px, y + 10 - ph, 3, ph);
          }
        }
      }
      R(g, '#2b3a50', 0, 118, 240, 17);
      break;
    }
    case 'BG05': {
      for (let y = 0; y < 70; y++) R(g, y < 40 ? '#05070d' : '#0a0d16', 0, y, 240, 1);
      stars(g, rand, 60, 240, 60);
      earth(g, 170, 22, 9);
      for (let x = 0; x < 240; x++) {
        const h = 60 + Math.sin(x / 17) * 4 + Math.sin(x / 5.3) * 1.5;
        R(g, '#9b9ea6', x, h, 1, 2);
        R(g, '#6e7179', x, h + 2, 1, 135 - h);
      }
      ground(g, rand, 96, '#5d6068', '#43464e', '#80838b');
      R(g, '#c9c6bd', 40, 92, 30, 8);
      R(g, '#2b3a50', 44, 88, 14, 5);
      R(g, '#5cc8d6', 46, 89, 6, 2);
      for (const wx of [42, 52, 62]) disc(g, '#1a1d24', wx + 2, 101, 3);
      break;
    }
    case 'BG06': {
      R(g, '#06080e', 0, 0, 240, 135);
      for (let x = 0; x < 240; x++) R(g, '#11141c', x, 30 + Math.sin(x / 13) * 6, 1, 3);
      ground(g, rand, 70, '#14171f', '#0b0d13', '#1c2029');
      for (let i = 0; i < 20; i++) R(g, rand() < 0.5 ? '#5cc8d6' : '#8fd8e2', rand() * 240, 75 + rand() * 60, 1, 1);
      break;
    }
    case 'BG08': {
      R(g, '#d9d4c6', 0, 0, 240, 135);
      R(g, '#8fa3b8', 150, 10, 80, 44);
      R(g, '#b7d3e6', 154, 14, 72, 36);
      R(g, '#8fa3b8', 190, 10, 2, 44);
      R(g, '#5f584d', 10, 14, 50, 36);
      for (let i = 0; i < 6; i++) R(g, ['#2f6fb0', '#e05a4f', '#7bc67e', '#d9a441'][i % 4], 14 + i * 7, 18, 5, 12);
      R(g, '#2b3a50', 0, 86, 240, 49);
      R(g, '#6b5a48', 50, 72, 140, 18);
      R(g, '#8a765f', 50, 72, 140, 3);
      for (const cx of [60, 100, 140, 176]) {
        R(g, '#3d4f6c', cx, 62, 12, 10);
        R(g, '#3d4f6c', cx, 96, 12, 10);
      }
      R(g, '#4c9a52', 222, 70, 10, 20);
      break;
    }
    case 'BG09': {
      R(g, '#04050a', 0, 0, 240, 135);
      stars(g, rand, 120, 240, 135);
      for (let y = 80; y < 135; y++) {
        const half = Math.sqrt(Math.max(0, 260 * 260 - (y - 340) * (y - 340)));
        R(g, y < 84 ? '#5cc8d6' : '#1f4f86', 120 - half, y, half * 2, 1);
      }
      for (let i = 0; i < 30; i++) R(g, '#ede6d3', rand() * 240, 90 + rand() * 45, 2 + rand() * 6, 1);
      disc(g, '#9b9ea6', 52, 34, 12);
      disc(g, '#7c7f86', 48, 30, 3);
      disc(g, '#7c7f86', 56, 40, 2);
      break;
    }
    default:
      R(g, '#17202f', 0, 0, 240, 135);
  }
  label(g, 'PLACEHOLDER ' + code, 2, 125);
}

export function placeholderBg(code: string): string {
  const key = 'bg:' + code;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(240, 135);
  drawBg(code, g);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

interface Look { skin: string; hair: string; top: string; topLite: string; legs: string; long: boolean; curly: boolean; glasses: boolean }
const LOOKS: Record<string, Look> = {
  AMARA: { skin: '#5a3a2a', hair: '#1a1622', top: '#ede6d3', topLite: '#ffffff', legs: '#ede6d3', long: true, curly: false, glasses: false },
  LUCIA: { skin: '#e0b090', hair: '#7a3a22', top: '#4a4a50', topLite: '#5e5e66', legs: '#2b2b30', long: true, curly: false, glasses: false },
  SIONE: { skin: '#9a6440', hair: '#5a3418', top: '#ede6d3', topLite: '#ffffff', legs: '#8a6a44', long: false, curly: true, glasses: true },
};

export function placeholderSprite(key: string, who: string, suit: boolean): string {
  const ck = 'sp:' + key;
  const hit = cache.get(ck);
  if (hit) return hit;
  const [c, g] = canvas(90, 152);
  const L = LOOKS[who] ?? LOOKS.AMARA;
  const smile = key.endsWith('_s');
  const tired = key === 'sio_c';
  const cx = 45;
  if (suit) {
    R(g, '#c9c6bd', cx - 24, 48, 48, 104);
    R(g, '#ede6d3', cx - 22, 50, 44, 100);
    R(g, '#8fa3b8', cx - 10, 64, 20, 14);
    R(g, '#e05a4f', cx - 8, 66, 4, 3);
    R(g, '#5cc8d6', cx + 2, 66, 6, 3);
    R(g, '#c9c6bd', cx - 30, 54, 8, 60);
    R(g, '#c9c6bd', cx + 22, 54, 8, 60);
    disc(g, '#ede6d3', cx, 26, 21);
    disc(g, '#2b3a50', cx, 27, 15);
    disc(g, L.skin, cx, 29, 10);
    R(g, L.hair, cx - 10, 18, 20, 5);
    R(g, '#5cc8d6', cx - 12, 14, 6, 2);
  } else {
    // Body and arms.
    R(g, L.top, cx - 20, 50, 40, 60);
    R(g, L.topLite, cx - 18, 52, 6, 50);
    R(g, L.top, cx - 28, 54, 8, 46);
    R(g, L.top, cx + 20, 54, 8, 46);
    R(g, L.skin, cx - 28, 100, 8, 8);
    R(g, L.skin, cx + 20, 100, 8, 8);
    R(g, L.legs, cx - 18, 110, 36, 42);
    R(g, '#0b0f1a', cx - 1, 120, 2, 32);
    R(g, L.skin, cx - 5, 42, 10, 9);
    // Hair behind the head.
    if (L.long) R(g, L.hair, cx - 17, 14, 34, who === 'LUCIA' ? 54 : 40);
    disc(g, L.skin, cx, 28, 14);
    // Hair on top.
    if (L.curly) {
      for (let i = -14; i <= 14; i += 4) disc(g, L.hair, cx + i, 15 + (Math.abs(i) > 9 ? 4 : 0), 4);
    } else {
      R(g, L.hair, cx - 15, 12, 30, 8);
      R(g, L.hair, cx - 15, 12, 5, 18);
      R(g, L.hair, cx + 10, 12, 5, 18);
    }
    // Face.
    if (tired) {
      R(g, '#0b0f1a', cx - 8, 28, 5, 1);
      R(g, '#0b0f1a', cx + 3, 28, 5, 1);
    } else {
      R(g, '#0b0f1a', cx - 7, 26, 3, 3);
      R(g, '#0b0f1a', cx + 4, 26, 3, 3);
    }
    if (L.glasses) {
      R(g, '#d9d4c6', cx - 10, 25, 8, 1);
      R(g, '#d9d4c6', cx + 2, 25, 8, 1);
      R(g, '#d9d4c6', cx - 2, 26, 4, 1);
    }
    if (smile) {
      R(g, '#0b0f1a', cx - 4, 35, 8, 1);
      R(g, '#0b0f1a', cx - 5, 34, 1, 1);
      R(g, '#0b0f1a', cx + 4, 34, 1, 1);
    } else R(g, '#0b0f1a', cx - 3, 35, 6, 1);
  }
  label(g, key, 0, 0);
  const url = c.toDataURL('image/png');
  cache.set(ck, url);
  return url;
}
