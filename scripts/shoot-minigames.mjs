// Dev helper: jumps to each minigame scene and screenshots it. Usage: node scripts/shoot-minigames.mjs <outdir>
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const out = process.argv[2];
const jumps = [
  ['ch1_3', { SHIELD: 25 }], ['ch2_4', { AIR: 32, SWAP_TIME: 30 }], ['ch3', {}], ['ch3_2', { OUTBOUND_COST: 28 }],
  ['ch4', {}], ['ch4_2', { HARVEST: 6 }], ['ch4_3', { SHIELD: 30, OUTSIDE: true }], ['ch5_2', { POWER: 8, FOOD: 8 }], ['ch5_3', {}],
];
const browser = await chromium.launch({ channel: 'msedge' });
const errors = [];
for (const [path, vars] of jumps) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(path + ': ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FILE_NOT_FOUND')) errors.push(path + ': ' + m.text()); });
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await page.waitForFunction(() => document.querySelector('.title-screen'));
  await page.evaluate(([p, v]) => { document.querySelector('.title-screen')?.remove(); window.__game.debugJump(p, v); }, [path, vars]);
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => window.__game.debugState().inMinigame)) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/mg-${path}.png` });
  await page.close();
}
console.log('errors:', JSON.stringify(errors));
await browser.close();
