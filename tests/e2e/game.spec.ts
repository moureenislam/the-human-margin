// Browser tests (guide 9.1). They drive the real UI; only the minigames are auto-resolved through a
// test hook, because each minigame is covered by its own outcome mapping and the story walker.
import { expect, test, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const GAME = pathToFileURL(resolve('dist/index.html')).href;

type Outcomes = Record<string, unknown>;
const GOOD: Outcomes = {
  shelter_drill: { drill: 5 },
  scrubber_swap: { success: true, attempts: 1 },
  route_planner: { cost: 28, shadow: 2 },
  drill_sample: { quality: 'perfect' },
  dust_sweep: { rows: 6 },
  power_triage: { order: ['Scrubbers', 'Heaters', 'Shelter', 'Comms', 'Rover', 'Lab', 'Lights'] },
  dose_log: {},
  final_budget: 'auto', // AIR 3, SHIELD = the D8 line, LAUNCH 4
  launch_checklist: { skips: 0 },
};

const SAFE = [
  'Build the full roof', 'Full grow lights', 'Swap the scrubber now', 'Turn back now', 'Go look at the panels first',
  'Clear half, then shelter', "Only what's on the approved list", '"We took care of each other."',
];

async function open(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // Missing art files (placeholders are drawn) and DONKI's rate limit are expected in CI.
    if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND|status of (404|429)|net::ERR_FAILED/.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem('hm-settings', JSON.stringify({ textSpeed: 0, muted: true, reduceMotion: true }));
  });
  await page.goto(GAME);
  await page.getByRole('button', { name: 'New game' }).waitFor();
}

async function useOutcomes(page: Page, o: Outcomes) {
  await page.evaluate((o) => {
    (window as any).__game.testOutcomes = (id: string, vars: any) =>
      o[id] === 'auto' ? { air: 3, shield: vars.SHIELD_LINE, launch: 4 } : o[id];
  }, o);
}

/** Plays until an ending panel shows. `pick` chooses a button text from the choices on screen. */
async function playUntilEnd(page: Page, pick: (texts: string[], title: string) => string, maxSteps = 600) {
  for (let i = 0; i < maxSteps; i++) {
    const s = await page.evaluate(() => {
      const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
      if (q('.journal') || q('#l-menus .menu')) return { kind: 'end' };
      if (q('#l-cards .card')) return { kind: 'card' };
      if (q('#l-overlay .fullcard')) return { kind: 'full' };
      const choices = [...document.querySelectorAll('#l-choices .choice')].map((c) => ({
        text: c.querySelector('.txt')!.textContent!,
        enabled: !c.classList.contains('disabled'),
      }));
      if (choices.length) return { kind: 'choice', choices, title: q('#l-choices .head')!.textContent! };
      return { kind: 'line' };
    });
    if (s.kind === 'end') return;
    if (s.kind === 'card') await page.locator('#l-cards .card button', { hasText: 'OK' }).click();
    else if (s.kind === 'full') await page.locator('#l-overlay .fullcard').click();
    else if (s.kind === 'choice') {
      const enabled = s.choices!.filter((c) => c.enabled).map((c) => c.text);
      const want = pick(enabled, s.title!);
      await page.locator('#l-choices .choice', { hasText: want }).first().click();
    } else await page.keyboard.press('Space');
  }
  throw new Error('no ending within ' + maxSteps + ' steps');
}

test('full run to Ridge Dawn, with the Data Journal', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole('button', { name: 'New game' }).click();
  await useOutcomes(page, GOOD);
  await playUntilEnd(page, (texts) => texts.find((t) => SAFE.includes(t)) ?? texts[0]);
  const state = await page.evaluate(() => (window as any).__game.debugState());
  expect(state.ui.ending.id).toBe('dawn');
  await expect(page.locator('.journal')).toBeVisible();
  await expect(page.locator('.journal .closing')).toHaveText('Every number in this game came from NASA open data. Which one surprised you?');
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'ML1', 'ML11']) expect(state.journal).toContain(id);
  await expect(page.getByRole('button', { name: 'Go back to the last decision' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Learning Ending 1 and its Rewind to 1.2', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole('button', { name: 'New game' }).click();
  await useOutcomes(page, { ...GOOD, shelter_drill: { drill: 10 } });
  await playUntilEnd(page, (texts) => texts.find((t) => t.startsWith('Science first')) ?? texts[0]);
  expect((await page.evaluate(() => (window as any).__game.debugState())).ui.ending.id).toBe('LE1');
  await page.getByRole('button', { name: 'Rewind to 1.2' }).click();
  await page.waitForFunction(() => (window as any).__game.debugState().ui.scene === '1.2');
  const v = (await page.evaluate(() => (window as any).__game.debugState())).vars;
  expect(v.SHIELD).toBe(0);
  expect(v.POWER).toBe(10);
  expect(v.IGNORED).toBe(0);
  expect(errors).toEqual([]);
});

test('save, reload the page and continue', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole('button', { name: 'New game' }).click();
  await useOutcomes(page, GOOD);
  // Advance into Chapter 1 (autosave at each scene start).
  await page.waitForTimeout(200);
  for (let i = 0; i < 30; i++) {
    const scene = await page.evaluate(() => (window as any).__game.debugState().ui.scene);
    if (scene === '1.2' && !(await page.locator('#l-cards .card').count())) break;
    if (await page.locator('#l-overlay .fullcard').count()) await page.locator('#l-overlay .fullcard').click();
    else if (await page.locator('#l-cards .card').count()) await page.locator('#l-cards .card button', { hasText: 'OK' }).click();
    else await page.keyboard.press('Space');
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: /Slot 1/ }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Load' }).click();
  await page.getByRole('button', { name: /Slot 1/ }).click();
  await page.waitForFunction(() => (window as any).__game.debugState().ui.scene === '1.2');
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForFunction(() => (window as any).__game.debugState().ui.scene === '1.2');
  expect(errors).toEqual([]);
});

test('DONKI blocked → the archived D8 card', async ({ page }) => {
  const errors: string[] = [];
  await page.route('**/api.nasa.gov/**', (r) => r.abort());
  await open(page, errors);
  await page.evaluate(() => {
    document.querySelector('.title-screen')?.remove();
    (window as any).__game.debugJump('ch5', { POWER_REFILL: 10, FOOD: 8 });
  });
  await useOutcomes(page, GOOD);
  await page.locator('#l-cards .card.data').waitFor({ timeout: 60_000, state: 'attached' }).catch(() => {});
  for (let i = 0; i < 40 && !(await page.locator('#l-cards .card .bar', { hasText: 'D8' }).count()); i++) {
    if (await page.locator('#l-choices .choice').count()) await page.locator('#l-choices .choice').first().click();
    else if (await page.locator('#l-cards .card').count()) await page.locator('#l-cards .card button', { hasText: 'OK' }).click();
    else await page.keyboard.press('Space');
    await page.waitForTimeout(100);
  }
  await expect(page.locator('#l-cards .card .bar')).toHaveText('D8 · SPACE WEATHER · ARCHIVED');
  await expect(page.locator('#l-cards .card')).toContainText('archived X8.2 flare of 10 Sept 2017');
  const v = (await page.evaluate(() => (window as any).__game.debugState())).vars;
  expect(v.SHIELD_LINE).toBe(3);
  expect(v.D8_SOURCE).toBe('ARCHIVED');
  expect(errors).toEqual([]);
});

test('the longest line pages instead of overflowing the dialogue box', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.evaluate(() => {
    document.querySelector('.title-screen')?.remove();
    (window as any).__game.debugJump('le4', {});
  });
  await page.locator('.dlg:not(.dlg-measure) .text').waitFor();
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(() => {
      const t = document.querySelector('.dlg:not(.dlg-measure) .text') as HTMLElement;
      return t.scrollHeight <= t.clientHeight + 2;
    });
    expect(ok).toBe(true);
    await page.keyboard.press('Space');
  }
  expect(errors).toEqual([]);
});

test('phone held upright shows the rotate prompt; landscape plays', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(GAME);
  await expect(page.locator('#rotate')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#rotate')).toBeHidden();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  await page.close();
});
