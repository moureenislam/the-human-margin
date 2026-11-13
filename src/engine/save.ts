// Save slots: 3 manual slots plus an autosave written at every scene start.
// ink saves its whole state as JSON; the engine adds the screen state and the Journal.
import type { HudItem, Mood, Slot } from './tags';

export interface UiState {
  bg: string | null;
  sprites: Partial<Record<Slot, string>>;
  insets: string[];
  call: Exclude<Mood, 'end'> | null;
  hud: HudItem[];
  zoom: boolean;
  timer: string | null;
  scene: string;
  sceneTitle: string;
  chapterTitle: string;
  ending: { id: string; title: string } | null;
  rewind: string | null;
  prop: string | null;
  ambient: string | null;
  journalScreen: boolean;
}

export interface Snapshot {
  ink: string;
  ui: UiState;
  journal: string[];
  warn: 'amber' | 'red' | null;
}

export interface SaveFile {
  v: 1;
  when: string;
  label: string;
  snap: Snapshot;
}

export type SlotId = 'auto' | '1' | '2' | '3';
export const SLOTS: SlotId[] = ['auto', '1', '2', '3'];
const key = (s: SlotId) => 'hm-save-' + s;

export function writeSave(slot: SlotId, snap: Snapshot, label: string): boolean {
  const file: SaveFile = { v: 1, when: new Date().toISOString(), label, snap };
  try {
    localStorage.setItem(key(slot), JSON.stringify(file));
    return true;
  } catch {
    return false;
  }
}

export function readSave(slot: SlotId): SaveFile | null {
  try {
    const raw = localStorage.getItem(key(slot));
    if (!raw) return null;
    const f = JSON.parse(raw) as SaveFile;
    return f && f.v === 1 && f.snap?.ink ? f : null;
  } catch {
    return null;
  }
}

export function hasAnySave(): boolean {
  return SLOTS.some((s) => readSave(s));
}
