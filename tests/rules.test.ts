import { describe, expect, it } from 'vitest';
import { clamp, closingSpeaker, co2mmHg, dose, flareRank, powerRefill, refillFromRows, shieldLineForClass, triageCorrect } from '../src/engine/rules';
import { parseChoiceTags, parseTag } from '../src/engine/tags';
import { parseLine } from '../src/engine/lines';
import { newStory, runGate, setVars } from './harness';

describe('dose formula (doc checks)', () => {
  it('SHIELD 25 with a perfect drill gives 112 mSv (rounded down, rule R6)', () => expect(dose(300, 25, 5)).toBe(112));
  it('SHIELD 10 with a late drill gives 216', () => expect(dose(300, 10, 8)).toBe(216));
  it('SHIELD 0 with no drill gives 300', () => expect(dose(300, 0, 10)).toBe(300));
  it('the ink story uses the same formula', () => {
    for (const shield of [0, 10, 25, 33, 40, 70, 100])
      for (const drill of [5, 8, 10] as const) {
        const s = newStory();
        setVars(s, { SHIELD: shield, DRILL: drill });
        expect(s.EvaluateFunction('storm_dose', [300])).toBe(dose(300, shield, drill));
        expect(s.EvaluateFunction('storm_dose', [200])).toBe(dose(200, shield, drill));
      }
  });
});

describe('air and CO2', () => {
  it('CO2 = 7 − AIR/10', () => {
    expect(co2mmHg(42)).toBe(2.8);
    expect(co2mmHg(60)).toBe(1);
    expect(co2mmHg(40)).toBe(3);
    expect(co2mmHg(25)).toBe(4.5);
  });
  it('clamps', () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    const s = newStory();
    setVars(s, { AIR: 90 });
    s.EvaluateFunction('add_air', [25]);
    expect(s.variablesState.$('AIR')).toBe(100);
  });
});

describe('power refill (rule R1)', () => {
  it('matches the ink start_chapter function', () => {
    for (const ch of [1, 2, 3, 4, 5])
      for (const refill of [7, 9, 10]) {
        const s = newStory();
        setVars(s, { POWER_REFILL: refill, POWER: 0 });
        s.EvaluateFunction('start_chapter', [ch]);
        expect(s.variablesState.$('POWER')).toBe(powerRefill(ch, refill));
        expect(s.variablesState.$('IGNORED')).toBe(0);
      }
  });
  it('dust sweep thresholds', () => {
    expect([0, 2, 3, 5, 6].map(refillFromRows)).toEqual([7, 7, 9, 9, 10]);
  });
});

describe('gates (rule R4 order: Learning Ending, Storm Return, Dark Return, continue)', () => {
  it('chapter 1', () => {
    expect(runGate('ch1_gate', { IGNORED: 2, DRILL: 10, DOSE: 300 })).toBe('LE1');
    expect(runGate('ch1_gate', { IGNORED: 2, DRILL: 8, DOSE: 300 })).toBe('storm');
    expect(runGate('ch1_gate', { IGNORED: 0, DRILL: 5, DOSE: 112 })).toBe('scene 2.1');
  });
  it('chapter 2', () => {
    expect(runGate('ch2_gate', { IGNORED: 2, SWAP_FAILED: true, AIR: 12 })).toBe('LE2');
    expect(runGate('ch2_gate', { IGNORED: 1, SWAP_FAILED: false, AIR: 37 })).toBe('dark');
    expect(runGate('ch2_gate', { AIR: 40 })).toBe('scene 3.1');
  });
  it('chapter 3', () => {
    expect(runGate('ch3_gate', { IGNORED: 2, BATTERY: 0 })).toBe('LE3');
    expect(runGate('ch3_gate', { IGNORED: 1, BATTERY: 10 })).toBe('dark');
    expect(runGate('ch3_gate', { BATTERY: 20 })).toBe('scene 4.1');
  });
  it('chapter 4', () => {
    expect(runGate('ch4_gate', { IGNORED: 2, TRIAGE_WRONG: true, DOSE: 300 })).toBe('LE4');
    expect(runGate('ch4_gate', { DOSE: 250 })).toBe('storm');
    expect(runGate('ch4_gate', { DOSE: 10, POWER: 0, AIR: 30 })).toBe('dark');
    expect(runGate('ch4_gate', { DOSE: 10, POWER: 0, AIR: 50 })).toBe('scene 5.1');
  });
  it('chapter 5', () => {
    const ok = { BUDGET_AIR: 3, BUDGET_LAUNCH: 4, BUDGET_SHIELD: 3, SHIELD_LINE: 3, FOOD: 3 };
    expect(runGate('ch5_gate', { ...ok, IGNORED: 2 })).toBe('LE5');
    expect(runGate('ch5_gate', { ...ok, BUDGET_SHIELD: 2 })).toBe('storm');
    expect(runGate('ch5_gate', { ...ok, FOOD: 2 })).toBe('dark');
    expect(runGate('ch5_gate', { ...ok, BUDGET_AIR: 2 })).toBe('dark');
    expect(runGate('ch5_gate', ok)).toBe('dawn');
  });
});

describe('Ridge Dawn closing line (rule R11)', () => {
  function closing(trust: { AMARA: number; LUCIA: number; SIONE: number }) {
    const s = newStory();
    setVars(s, { TRUST_AMARA: trust.AMARA, TRUST_LUCIA: trust.LUCIA, TRUST_SIONE: trust.SIONE, LAST_WORDS: "Let's come back." });
    s.ChoosePathString('ridge_dawn');
    while (s.canContinue) {
      const line = parseLine(s.Continue());
      if (line?.text === "Let's come back.") return line.speaker;
    }
    return null;
  }
  it('goes to the highest trust, ties Amara > Sione > Lucia', () => {
    for (const t of [
      { AMARA: 3, LUCIA: 2, SIONE: 2 },
      { AMARA: 2, LUCIA: 5, SIONE: 1 },
      { AMARA: 1, LUCIA: 3, SIONE: 3 },
      { AMARA: 2, LUCIA: 2, SIONE: 2 },
      { AMARA: 0, LUCIA: 4, SIONE: 4 },
    ])
      expect(closing(t)).toBe(closingSpeaker(t));
  });
});

describe('small rules', () => {
  it('power triage', () => {
    expect(triageCorrect(['Heaters', 'Shelter', 'Scrubbers', 'Lab', 'Lights', 'Comms', 'Rover'])).toBe(true);
    expect(triageCorrect(['Heaters', 'Lab', 'Scrubbers', 'Shelter', 'Lights', 'Comms', 'Rover'])).toBe(false);
  });
  it('D8 class → shield cubes', () => {
    expect(shieldLineForClass('X1.1')).toBe(3);
    expect(shieldLineForClass('M5.0')).toBe(2);
    expect(shieldLineForClass('C9.9')).toBe(1);
    expect(shieldLineForClass(null)).toBe(1);
    expect(flareRank('X1.0')).toBeGreaterThan(flareRank('M9.9'));
    expect(flareRank('M2.1')).toBeGreaterThan(flareRank('M1.4'));
  });
  it('parses tags, lines and choice costs', () => {
    expect(parseTag('show: L AMA-D')).toEqual({ k: 'show', slot: 'L', code: 'AMA-D' });
    expect(parseTag('')).toBeNull();
    expect(() => parseTag('nonsense: 1')).toThrow();
    expect(parseLine('AMARA (radio crackles back): "Sixty. That\'s the line."')).toEqual({
      kind: 'speech', speaker: 'AMARA', radio: true, direction: 'crackles back', text: "Sixty. That's the line.",
    });
    expect(parseLine('(You stand up too fast and wobble. Mimi grabs your arm.)')?.kind).toBe('narration');
    expect(parseChoiceTags(['fx: POWER −6, SHIELD +40', 'title: The Roof']).powerNeed).toBe(6);
  });
});
