// Pure game rules. The ink story applies the same formulas; tests check both agree.
// Every number here is from the Lean Build script unless marked "design choice" (guide section 6).

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Drill multiplier in tenths: perfect 0.5, late 0.8, failed or skipped 1.0. */
export type DrillTenths = 5 | 8 | 10;

/** DOSE = STORM × (1 − SHIELD/100) × drill, rounded down (rule R6). Integer maths, so no float drift. */
export function dose(storm: number, shield: number, drillTenths: DrillTenths): number {
  return Math.floor((storm * (100 - clamp(shield, 0, 100)) * drillTenths) / 1000);
}

/** AIR to CO2 tooltip: CO2 (mmHg) = 7 − AIR/10. */
export function co2mmHg(air: number): number {
  return Math.round((7 - air / 10) * 10) / 10;
}

export const LIMITS = {
  doseEvent: 250, // NASA per-event limit, mSv (D2)
  doseCareer: 600, // NASA career limit, mSv (D2)
  airAmber: 40, // AIR 40 = 3 mmHg (D3)
  airRed: 25, // AIR 25 = 4.5 mmHg (D3)
  foodLine: 3, // Final Budget food line, days
  batteryLine: 20, // Chapter 3 gate, %
  budgetAir: 3,
  budgetLaunch: 4,
} as const;

/** Rule R1: each chapter starts with that day's refill; unspent cubes don't carry over. */
export function powerRefill(chapter: number, powerRefillVar: number): number {
  if (chapter <= 3) return 10;
  if (chapter === 4) return 7;
  return powerRefillVar >= 9 ? 10 : 8;
}

/** Card D8: X-class → 3 cubes, M-class → 2, quieter → 1. */
export function shieldLineForClass(classType: string | null): 1 | 2 | 3 {
  const c = (classType ?? '').trim().toUpperCase();
  if (c.startsWith('X')) return 3;
  if (c.startsWith('M')) return 2;
  return 1;
}

/** Ranks a GOES class string (e.g. "X8.7", "M1.2", "C3") so the strongest flare can be picked. */
export function flareRank(classType: string): number {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)?/i.exec(classType.trim());
  if (!m) return -1;
  const band = 'ABCMX'.indexOf(m[1].toUpperCase());
  const mag = m[2] ? parseFloat(m[2]) : 1;
  return band * 1000 + mag;
}

/** Dust Sweep: 6 rows clean → refill 10; 3 to 5 rows ("half", design choice) → 9; fewer → stays 7. */
export function refillFromRows(rows: number): 7 | 9 | 10 {
  if (rows >= 6) return 10;
  if (rows >= 3) return 9;
  return 7;
}

/** Power Triage is correct if Scrubbers, Heaters and Shelter are the top three in any order. */
export function triageCorrect(order: string[]): boolean {
  const top = new Set(order.slice(0, 3));
  return top.size === 3 && ['Scrubbers', 'Heaters', 'Shelter'].every((s) => top.has(s));
}

/** Route Planner tile costs (design choice, guide P2): lit 4%, shadow 8% (the doc's 2×). 5 steps → 20–40%. */
export const TILE_COST = { lit: 4, shadow: 8 } as const;

/** Rule R11: Ridge Dawn closing line goes to the highest TRUST; ties go Amara, then Sione, then Lucia. */
export function closingSpeaker(trust: { AMARA: number; LUCIA: number; SIONE: number }): 'AMARA' | 'SIONE' | 'LUCIA' {
  const order: Array<'AMARA' | 'SIONE' | 'LUCIA'> = ['AMARA', 'SIONE', 'LUCIA'];
  let best = order[0];
  for (const who of order) if (trust[who] > trust[best]) best = who;
  return best;
}
