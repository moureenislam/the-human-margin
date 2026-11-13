// Contract between the engine and each minigame.
// A minigame draws into ctx.root (a 1920×1080 stage-pixel layer), resolves with its outcome,
// and never touches ink directly: src/engine/outcomes.ts turns the outcome into ink variables,
// and the story walker uses the same mapping, so the game and the tests can't drift apart.

import type { SfxName } from '../engine/audio';

export interface Clock {
  /** Milliseconds of unpaused game time since the clock was created. */
  now(): number;
  readonly paused: boolean;
}

export interface MinigameContext {
  /** Empty, absolutely positioned layer covering the whole 1920×1080 stage. Clear it before resolving. */
  root: HTMLElement;
  /** Snapshot of the ink variables when the minigame started (read-only). */
  vars: Readonly<Record<string, number | string | boolean>>;
  /** Extra words from the tag, e.g. "# minigame: shelter_drill fast" → { fast: true }. */
  params: Readonly<Record<string, string | true>>;
  /** Pausable game clock. Use it (or onFrame's dt) for every timer, so Esc really pauses. */
  clock: Clock;
  /** Calls cb every animation frame with elapsed unpaused ms. Returns a stop function. */
  onFrame(cb: (dtMs: number) => void): () => void;
  sfx(name: SfxName): void;
  /** Shows one line in the dialogue box (nameplate + text) and resolves when the player advances. */
  say(speaker: string, text: string): Promise<void>;
  /** Shows the top-right reference chip for this ref id (e.g. "D8") until cleared with null. */
  setRef(ref: string | null, extra?: string): void;
  reduceMotion: boolean;
}

export interface Outcomes {
  shelter_drill: { drill: 5 | 8 | 10 };
  scrubber_swap: { success: boolean; attempts: 1 | 2 };
  route_planner: { cost: number; shadow: number };
  drill_sample: { quality: 'perfect' | 'early' | 'late' };
  dust_sweep: { rows: number };
  power_triage: { order: string[] };
  dose_log: Record<string, never>;
  final_budget: { air: number; shield: number; launch: number };
  launch_checklist: { skips: 0 | 1 | 2 };
}

export type MinigameId = keyof Outcomes;

export interface Minigame<K extends MinigameId = MinigameId> {
  id: K;
  run(ctx: MinigameContext): Promise<Outcomes[K]>;
}
