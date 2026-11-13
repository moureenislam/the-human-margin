// Minigame ids without importing the minigames themselves (keeps the tag parser DOM-free for tests).
import type { MinigameId } from './types';

export const MINIGAME_IDS: MinigameId[] = [
  'shelter_drill',
  'scrubber_swap',
  'route_planner',
  'drill_sample',
  'dust_sweep',
  'power_triage',
  'dose_log',
  'final_budget',
  'launch_checklist',
];

export function isMinigameId(id: string | undefined): id is MinigameId {
  return !!id && (MINIGAME_IDS as string[]).includes(id);
}
