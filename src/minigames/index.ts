import type { Minigame, MinigameId } from './types';
import { shelterDrill } from './shelterDrill';
import { scrubberSwap } from './scrubberSwap';
import { routePlanner } from './routePlanner';
import { drillSample } from './drillSample';
import { dustSweep } from './dustSweep';
import { powerTriage } from './powerTriage';
import { doseLog } from './doseLog';
import { finalBudget } from './finalBudget';
import { launchChecklist } from './checklist';

export const MINIGAMES: { [K in MinigameId]: Minigame<K> } = {
  shelter_drill: shelterDrill,
  scrubber_swap: scrubberSwap,
  route_planner: routePlanner,
  drill_sample: drillSample,
  dust_sweep: dustSweep,
  power_triage: powerTriage,
  dose_log: doseLog,
  final_budget: finalBudget,
  launch_checklist: launchChecklist,
};

export function isMinigameId(id: string): id is MinigameId {
  return id in MINIGAMES;
}
