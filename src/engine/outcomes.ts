// Minigame outcome → ink variable writes. Shared by the engine and the story walker.
import type { MinigameId, Outcomes } from '../minigames/types';
import { refillFromRows, triageCorrect, TILE_COST } from './rules';

export type InkVars = Record<string, number | string | boolean>;

export function applyOutcome<K extends MinigameId>(id: K, o: Outcomes[K], vars: InkVars): InkVars {
  switch (id) {
    case 'shelter_drill': {
      const r = o as Outcomes['shelter_drill'];
      return { DRILL: r.drill };
    }
    case 'scrubber_swap': {
      const r = o as Outcomes['scrubber_swap'];
      return { SWAP_OK: r.success, SWAP_FAILED: !r.success };
    }
    case 'route_planner': {
      const r = o as Outcomes['route_planner'];
      return { OUTBOUND_COST: r.cost, SHADOW_TILES: r.shadow };
    }
    case 'drill_sample': {
      const r = o as Outcomes['drill_sample'];
      return { SAMPLE: r.quality === 'perfect' ? 2 : r.quality === 'early' ? 1 : 0, DRILL_LATE: r.quality === 'late' };
    }
    case 'dust_sweep': {
      const r = o as Outcomes['dust_sweep'];
      return { POWER_REFILL: refillFromRows(r.rows) };
    }
    case 'power_triage': {
      const r = o as Outcomes['power_triage'];
      return { TRIAGE_WRONG: !triageCorrect(r.order) };
    }
    case 'dose_log':
      return {};
    case 'final_budget': {
      const r = o as Outcomes['final_budget'];
      return { BUDGET_AIR: r.air, BUDGET_SHIELD: r.shield, BUDGET_LAUNCH: r.launch };
    }
    case 'launch_checklist': {
      const r = o as Outcomes['launch_checklist'];
      return { IGNORED: r.skips === 2 ? 2 : Number(vars.IGNORED ?? 0) };
    }
  }
  throw new Error('unknown minigame ' + id);
}

/** Every distinct outcome a minigame can produce, for the story walker. */
export function possibleOutcomes<K extends MinigameId>(id: K, vars: InkVars): Outcomes[K][] {
  const all = ((): unknown[] => {
    switch (id) {
      case 'shelter_drill':
        return [{ drill: 5 }, { drill: 8 }, { drill: 10 }];
      case 'scrubber_swap':
        return [{ success: true, attempts: 1 }, { success: false, attempts: 2 }];
      case 'route_planner': {
        // 5 steps, each lit (4) or shadow (8): cost = 20 + 4 × shadow tiles.
        const out = [];
        for (let shadow = 0; shadow <= 5; shadow++) out.push({ cost: 5 * TILE_COST.lit + shadow * (TILE_COST.shadow - TILE_COST.lit), shadow });
        return out;
      }
      case 'drill_sample':
        return [{ quality: 'perfect' }, { quality: 'early' }, { quality: 'late' }];
      case 'dust_sweep':
        return [{ rows: 6 }, { rows: 4 }, { rows: 0 }];
      case 'power_triage':
        return [
          { order: ['Scrubbers', 'Heaters', 'Shelter', 'Comms', 'Rover', 'Lab', 'Lights'] },
          { order: ['Lab', 'Lights', 'Scrubbers', 'Heaters', 'Shelter', 'Comms', 'Rover'] },
        ];
      case 'dose_log':
        return [{}];
      case 'final_budget': {
        // Every allocation of the cubes, reduced to one per outcome class: only whether AIR ≥ 3 and
        // LAUNCH ≥ 4, and SHIELD as 0, 1, 2 or 3+ (the D8 lines), can change the ending.
        const cubes = Number(vars.POWER ?? 10);
        const byClass = new Map<string, { air: number; shield: number; launch: number }>();
        for (let air = 0; air <= cubes; air++)
          for (let shield = 0; shield <= cubes - air; shield++)
            for (let launch = 0; launch <= cubes - air - shield; launch++) {
              const cls = `${air >= 3}|${launch >= 4}|${Math.min(shield, 3)}`;
              if (!byClass.has(cls)) byClass.set(cls, { air, shield, launch });
            }
        return [...byClass.values()];
      }
      case 'launch_checklist':
        return [{ skips: 0 }, { skips: 1 }, { skips: 2 }];
    }
    return [];
  })();
  return all as Outcomes[K][];
}
