// The engine: runs the ink story, reads its tags line by line, and drives every screen.
import { Story } from 'inkjs';
import storyJson from '../../story/main.ink';
import { parseTag, parseChoiceTags, type Tag, type Slot } from './tags';
import { parseLine, type Line } from './lines';
import { applyOutcome } from './outcomes';
import { audio, type AmbientName } from './audio';
import { clock, frameLoop } from './clock';
import { settings } from './settings';
import { readSave, writeSave, type Snapshot, type UiState, type SlotId } from './save';
import { fetchD8, fetchedLabel, type D8Result } from './donki';
import { VAR_NAMES } from './vars';
import { MINIGAMES } from '../minigames';
import { dropMinigameKeys } from '../minigames/kit';
import type { MinigameContext } from '../minigames/types';
import { SceneView } from '../ui/scene';
import { Dialogue } from '../ui/dialogue';
import { showChoices } from '../ui/choices';
import { Hud, RefChip } from '../ui/hud';
import { CARDS, showCard, showFullCard, showLessonCard, showNote } from '../ui/cards';
import { Menus } from '../ui/menus';
import { keyDepth, onUnhandledEscape, pushKeys, resetKeys } from '../ui/input';
import { spriteWho, missingAssets } from '../ui/assets';
import { toast, type StageRefs } from '../ui/stage';

const EMPTY_UI = (): UiState => ({
  bg: null,
  sprites: {},
  insets: [],
  call: null,
  hud: [],
  zoom: false,
  timer: null,
  scene: '',
  sceneTitle: '',
  chapterTitle: 'Prologue',
  ending: null,
  rewind: null,
  prop: null,
  ambient: null,
  journalScreen: false,
});

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function hashLine(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export class Game {
  private story: any = null;
  private ui: UiState = EMPTY_UI();
  private journalIds: string[] = [];
  private warn: 'amber' | 'red' | null = null;
  private gen = 0;
  private inGame = false;
  private inMinigame = false;
  private pausing = false;
  /** R10: full snapshot before every choice and minigame. */
  private lastDecision: Snapshot | null = null;
  /** Snapshot at the start of each scene, for Learning Ending rewinds. */
  private sceneSnaps: Record<string, Snapshot> = {};
  /** Where a save made right now would resume (start of the current line, choice or minigame). */
  private resumePoint: Snapshot | null = null;
  private closingLine: string | null = null;
  private d8: D8Result | null = null;
  private d8Promise: Promise<D8Result> | null = null;
  private seen = new Set<string>();
  private minigameStops = new Set<() => void>();
  private baseKeys: number;
  /** Test hook: when set, minigames resolve with this outcome instead of opening (browser tests only). */
  testOutcomes: ((id: string, vars: Record<string, any>) => unknown) | null = null;

  private scene: SceneView;
  private dialogue: Dialogue;
  private ref: RefChip;
  private hud: Hud;
  private menus: Menus;

  constructor(private r: StageRefs) {
    this.scene = new SceneView(r);
    this.dialogue = new Dialogue(r);
    this.ref = new RefChip(r);
    this.hud = new Hud(r, this.ref);
    this.menus = new Menus(r);
    this.dialogue.onSpeaker = (w) => this.scene.speaking(w);
    this.ref.onOpen = (id) => this.openRef(id);
    try {
      this.seen = new Set(JSON.parse(localStorage.getItem('hm-seen') ?? '[]'));
    } catch {
      /* storage unavailable */
    }
    onUnhandledEscape(() => this.pause());
    // Bottom of the key stack: game-wide keys.
    pushKeys((e) => {
      if (!this.inGame || this.inMinigame || this.pausing) return false;
      const k = e.key.toLowerCase();
      if (k === 'l') {
        this.withPause(() => this.menus.backlog(this.dialogue.backlog));
        return true;
      }
      if (k === 'a') {
        this.dialogue.auto = !this.dialogue.auto;
        this.dialogue.setModes();
        toast(r.layer.toast, this.dialogue.auto ? 'Auto-advance on' : 'Auto-advance off');
        return true;
      }
      if (k === 's') {
        this.dialogue.skip = !this.dialogue.skip;
        this.dialogue.setModes();
        toast(r.layer.toast, this.dialogue.skip ? 'Skip seen lines on' : 'Skip off');
        return true;
      }
      return false;
    });
    this.baseKeys = keyDepth();
    this.applySettings();
  }

  applySettings() {
    audio.setVolume(settings.volume, settings.muted);
    document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  }

  // ---------------------------------------------------------------- title and game start

  async title() {
    this.teardown();
    this.inGame = false;
    audio.ambient(null);
    this.ui = EMPTY_UI();
    this.scene.render(this.ui);
    this.hud.update([], {});
    for (;;) {
      const pick = await this.menus.title(!!readSave('auto'), missingAssets().length);
      if (pick === 'new') return this.newGame();
      if (pick === 'continue') {
        const f = readSave('auto');
        if (f) return this.startFrom(f.snap);
      }
      if (pick === 'load') {
        const slot = await this.menus.slots('load');
        const f = slot && readSave(slot);
        if (f) return this.startFrom(f.snap);
      }
      if (pick === 'settings') await this.menus.settings(() => this.applySettings());
      if (pick === 'credits') await this.menus.credits();
    }
  }

  newGame() {
    this.story = new Story(storyJson);
    this.sceneSnaps = {};
    this.lastDecision = null;
    this.d8 = null;
    this.d8Promise = null;
    this.startFrom({ ink: this.story.state.ToJson(), ui: EMPTY_UI(), journal: [], warn: null });
  }

  /** Test hook: start at any knot (e.g. "ch3_2") with some variables set. */
  debugJump(path: string, vars: Record<string, any> = {}, hud: UiState['hud'] = ['POWER', 'AIR', 'SHIELD', 'FOOD']) {
    this.story = new Story(storyJson);
    this.sceneSnaps = {};
    this.lastDecision = null;
    this.setVars(vars);
    this.story.ChoosePathString(path);
    this.startFrom({ ink: this.story.state.ToJson(), ui: { ...EMPTY_UI(), hud }, journal: [], warn: null });
  }

  /** Test hook: what the player would see right now. */
  debugState() {
    return { vars: this.vars(), ui: clone(this.ui), journal: [...this.journalIds], inMinigame: this.inMinigame };
  }

  /** Starts (or restarts) play from a snapshot: new game, load, continue or rewind. */
  private startFrom(snap: Snapshot) {
    this.teardown();
    if (!this.story) this.story = new Story(storyJson);
    this.story.state.LoadJson(snap.ink);
    this.ui = clone(snap.ui);
    this.journalIds = [...snap.journal];
    this.warn = snap.warn;
    this.closingLine = null;
    this.inGame = true;
    this.scene.render(this.ui);
    audio.ambient(this.ui.ambient as AmbientName);
    this.syncHud();
    const gen = ++this.gen;
    this.loop(gen).catch((e) => this.fatal(e));
  }

  /** Abandons whatever is on screen (pending line, card, choice, minigame). */
  private teardown() {
    this.gen++;
    this.dialogue.cancel();
    for (const s of this.minigameStops) s();
    this.minigameStops.clear();
    dropMinigameKeys();
    this.inMinigame = false;
    for (const l of ['choices', 'cards', 'overlay', 'minigame'] as const) this.r.layer[l].replaceChildren();
    this.r.layer.dialogue.classList.remove('raised');
    this.ref.pin(null);
    this.ref.setLine(null);
    resetKeys(this.baseKeys);
    if (clock.paused) clock.resume();
  }

  private fatal(e: unknown) {
    console.error(e);
    toast(this.r.layer.toast, 'Something went wrong: ' + String((e as any)?.message ?? e), 6000);
  }

  // ---------------------------------------------------------------- main loop

  private snapshot(): Snapshot {
    return { ink: this.story.state.ToJson(), ui: clone(this.ui), journal: [...this.journalIds], warn: this.warn };
  }

  private vars(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const n of VAR_NAMES) out[n] = this.story.variablesState.$(n);
    return out;
  }

  private syncHud() {
    if (!this.story) return;
    this.hud.update(this.ui.hud, this.vars());
  }

  private async loop(gen: number) {
    const alive = () => gen === this.gen;
    while (alive()) {
      if (this.story.canContinue) {
        const pre = this.snapshot();
        this.resumePoint = pre;
        const raw: string = this.story.Continue();
        const tags = (this.story.currentTags ?? []).map(parseTag).filter(Boolean) as Tag[];
        let minigame: Extract<Tag, { k: 'minigame' }> | null = null;
        let lineRef: string | null = null;
        for (const t of tags) {
          if (t.k === 'minigame') minigame = t;
          else if (t.k === 'ref') lineRef = t.id;
          else {
            await this.applyTag(t, pre);
            if (!alive()) return;
          }
        }
        this.syncHud();
        if (minigame) this.lastDecision = pre;
        const line = parseLine(raw);
        if (line) {
          this.ref.setLine(lineRef);
          await this.showLine(line, raw);
          if (!alive()) return;
          this.ref.setLine(null);
        }
        if (minigame) {
          await this.runMinigame(minigame, gen);
          if (!alive()) return;
          this.syncHud();
        }
      } else if (this.story.currentChoices.length) {
        const snap = this.snapshot();
        this.resumePoint = snap;
        const power = Number(this.story.variablesState.$('POWER'));
        const items = (this.story.currentChoices as any[]).map((c) => {
          const meta = parseChoiceTags(c.tags);
          return { text: c.text, meta, enabled: meta.powerNeed <= power };
        });
        if (!items.some((i) => i.meta.flavour)) this.lastDecision = snap;
        this.ref.setLine(null);
        const idx = await showChoices(this.r, items, this.warn);
        if (!alive()) return;
        this.warn = null;
        this.r.stage.classList.remove('pulse-red');
        this.story.ChooseChoiceIndex(idx);
      } else {
        await this.finish(gen);
        return;
      }
    }
  }

  private async applyTag(t: Tag, pre: Snapshot) {
    const ui = this.ui;
    switch (t.k) {
      case 'scene': {
        ui.scene = t.id;
        ui.sceneTitle = t.title;
        ui.sprites = {};
        ui.insets = [];
        ui.call = null;
        ui.zoom = false;
        ui.timer = null;
        this.sceneSnaps[t.id] = pre;
        if (!ui.ending) writeSave('auto', pre, `${ui.chapterTitle} · ${t.id} ${t.title}`);
        break;
      }
      case 'chapter':
        ui.chapterTitle = `Chapter ${t.n}: ${t.title}`;
        if (t.n === 5) this.d8Promise = fetchD8();
        break;
      case 'bg':
        ui.bg = t.code;
        break;
      case 'show':
        ui.sprites[t.slot] = t.code;
        break;
      case 'hide':
        if (t.slot === 'all') ui.sprites = {};
        else delete ui.sprites[t.slot];
        break;
      case 'swap': {
        const who = spriteWho(t.code);
        const slots: Slot[] = ['L', 'C', 'R'];
        const at = slots.find((s) => ui.sprites[s] && spriteWho(ui.sprites[s]!) === who);
        if (at) ui.sprites[at] = t.code;
        else {
          // The reacting crewmate isn't on stage: bring them in at a free spot.
          const free = (['R', 'L', 'C'] as Slot[]).find((s) => !ui.sprites[s]);
          if (free) ui.sprites[free] = t.code;
        }
        break;
      }
      case 'inset':
        ui.insets = t.codes;
        break;
      case 'hideinset':
        ui.insets = [];
        break;
      case 'call':
        if (t.mood === 'end') {
          if (ui.call) audio.sfx('static');
          ui.call = null;
        } else ui.call = t.mood;
        break;
      case 'zoom':
        ui.zoom = t.on;
        break;
      case 'timer':
        ui.timer = t.text;
        break;
      case 'hud':
        ui.hud = t.mode === 'none' ? [] : t.mode === 'add' ? [...new Set([...ui.hud, ...t.items])] : t.items;
        break;
      case 'ambient':
        ui.ambient = t.name;
        audio.ambient(t.name as AmbientName);
        break;
      case 'sfx':
        audio.sfx(t.name as any);
        break;
      case 'warn':
        this.warn = t.level;
        if (t.level === 'red' && !settings.reduceMotion) this.r.stage.classList.add('pulse-red');
        break;
      case 'card':
      case 'echo': {
        this.addJournal(t.id);
        this.scene.render(ui);
        this.dialogue.hide();
        this.ref.pin(t.id, t.id === 'D8' && this.d8 ? fetchedLabel(this.d8) : undefined);
        await showCard(this.r, t.id, t.id === 'D8' ? this.d8 : null);
        this.ref.pin(null);
        break;
      }
      case 'journal':
        for (const id of t.ids) this.addJournal(id);
        break;
      case 'fetch_donki': {
        const d8 = await (this.d8Promise ?? fetchD8());
        this.d8 = d8;
        const t2 = new Date(d8.fetchedAt);
        this.setVars({
          SHIELD_LINE: d8.cubes,
          D8_CLASS: d8.classType ?? 'none',
          D8_SOURCE: d8.source,
          D8_FETCHED: `${t2.toISOString().slice(0, 10)} ${t2.toISOString().slice(11, 16)} UTC`,
        });
        break;
      }
      case 'ending':
        ui.ending = { id: t.id, title: t.title };
        break;
      case 'rewind':
        ui.rewind = t.scene;
        break;
      case 'prop':
        ui.prop = t.name;
        break;
      case 'journal_screen':
        ui.journalScreen = true;
        break;
      case 'ref_needed':
        // Guide 5.5: lines marked [REF needed] show no chip until a source is added.
        break;
    }
    this.scene.render(ui);
  }

  private addJournal(id: string) {
    if (CARDS[id] && !this.journalIds.includes(id)) this.journalIds.push(id);
  }

  private setVars(v: Record<string, any>) {
    for (const [k, val] of Object.entries(v)) this.story.variablesState.$(k, val);
  }

  private async showLine(line: Line, raw: string) {
    switch (line.kind) {
      case 'title':
      case 'fade':
        this.dialogue.hide();
        return showFullCard(this.r, line.text);
      case 'lesson':
      case 'question':
        this.dialogue.hide();
        return showLessonCard(this.r, line.kind, line.text, this.ui.prop);
      case 'system':
        if (this.ui.journalScreen) {
          this.closingLine = line.text;
          return;
        }
    }
    const h = hashLine(raw);
    const seen = this.seen.has(h);
    await this.dialogue.show(line, { seen });
    if (!seen) {
      this.seen.add(h);
      this.saveSeenSoon();
    }
  }

  private seenTimer = 0;
  private saveSeenSoon() {
    clearTimeout(this.seenTimer);
    this.seenTimer = window.setTimeout(() => {
      try {
        localStorage.setItem('hm-seen', JSON.stringify([...this.seen]));
      } catch {
        /* storage unavailable */
      }
    }, 1000);
  }

  // ---------------------------------------------------------------- minigames

  private async runMinigame(t: Extract<Tag, { k: 'minigame' }>, gen: number) {
    const root = this.r.layer.minigame;
    root.replaceChildren();
    root.className = 'layer';
    const vars = this.vars();
    this.inMinigame = true;
    const ctx: MinigameContext = {
      root,
      vars,
      params: t.params,
      clock,
      onFrame: (cb) => {
        const stop = frameLoop(cb);
        const s = () => {
          stop();
          this.minigameStops.delete(s);
        };
        this.minigameStops.add(s);
        return s;
      },
      sfx: (n) => audio.sfx(n),
      say: async (speaker, text) => {
        const line = parseLine(`${speaker}: ${text}`) ?? { kind: 'system' as const, text };
        await this.dialogue.show(line, { raised: true });
        this.dialogue.hide();
      },
      setRef: (id, extra) => this.ref.pin(id, extra),
      reduceMotion: settings.reduceMotion,
    };
    this.dialogue.hide();
    const outcome = this.testOutcomes ? this.testOutcomes(t.id, vars) : await MINIGAMES[t.id].run(ctx as any);
    if (gen !== this.gen) return;
    this.inMinigame = false;
    root.replaceChildren();
    this.ref.pin(null);
    this.setVars(applyOutcome(t.id, outcome as any, vars));
  }

  // ---------------------------------------------------------------- endings, rewind

  private async finish(gen: number) {
    const e = this.ui.ending;
    this.dialogue.hide();
    const isLE = !!e && e.id.startsWith('LE');
    for (;;) {
      let pick: string;
      if (isLE) {
        const actions = [];
        if (this.ui.rewind && this.sceneSnaps[this.ui.rewind]) actions.push({ label: `Rewind to ${this.ui.rewind}`, value: 'scene' });
        if (this.lastDecision) actions.push({ label: 'Go back to the last decision', value: 'decision' });
        actions.push({ label: 'Data Journal', value: 'journal' }, { label: 'Title screen', value: 'title' });
        pick = await this.menus.endPanel(`Learning Ending · ${e!.title}`, actions);
      } else {
        const actions = [];
        if (this.lastDecision) actions.push({ label: 'Go back to the last decision', value: 'decision' });
        actions.push({ label: 'Title screen', value: 'title' });
        pick = await this.menus.journal(this.journalIds, actions, this.closingLine ?? 'Every number in this game came from NASA open data. Which one surprised you?');
      }
      if (gen !== this.gen) return;
      if (pick === 'journal') {
        await this.menus.journal(this.journalIds, [{ label: 'Close', value: 'close' }], null);
        continue;
      }
      if (pick === 'scene' && this.ui.rewind) return this.rewindTo(this.sceneSnaps[this.ui.rewind]);
      if (pick === 'decision' && this.lastDecision) return this.rewindTo(this.lastDecision);
      return this.title();
    }
  }

  /** Rewind keeps the Journal: cards already seen stay learned. */
  private rewindTo(snap: Snapshot) {
    const keep = [...this.journalIds];
    const s = clone(snap);
    s.journal = [...new Set([...s.journal, ...keep])];
    this.startFrom(s);
  }

  // ---------------------------------------------------------------- pause, refs

  private async withPause(fn: () => Promise<unknown>) {
    if (this.pausing) return;
    this.pausing = true;
    clock.pause();
    try {
      await fn();
    } finally {
      clock.resume();
      this.pausing = false;
    }
  }

  pause() {
    if (!this.inGame || this.pausing) return;
    this.withPause(async () => {
      for (;;) {
        const v = await this.menus.pause();
        if (v === 'resume') return;
        if (v === 'save') {
          const slot = await this.menus.slots('save');
          if (slot && this.resumePoint) {
            const ok = writeSave(slot as SlotId, this.resumePoint, `${this.ui.chapterTitle} · ${this.ui.scene} ${this.ui.sceneTitle}`);
            toast(this.r.layer.toast, ok ? 'Saved' : 'Could not save (storage blocked)');
            return;
          }
          continue;
        }
        if (v === 'load') {
          const slot = await this.menus.slots('load');
          const f = slot && readSave(slot);
          if (f) {
            this.pausing = false;
            this.startFrom(f.snap);
            return;
          }
          continue;
        }
        if (v === 'journal') await this.menus.journal(this.journalIds, [{ label: 'Close', value: 'close' }], null);
        if (v === 'log') await this.menus.backlog(this.dialogue.backlog);
        if (v === 'settings') await this.menus.settings(() => this.applySettings());
        if (v === 'title') {
          if (await this.menus.confirm('Quit to the title screen? Progress since the last autosave (start of this scene) is lost.')) {
            this.pausing = false;
            clock.resume();
            this.title();
            return;
          }
        }
      }
    });
  }

  private openRef(id: string) {
    if (CARDS[id]) this.withPause(() => showCard(this.r, id, id === 'D8' ? this.d8 : null));
    else this.withPause(() => showNote(this.r, id));
  }
}
