# The Human Margin

A choice-based browser game for NASA Space Apps 2026: a Prologue, 5 chapters, 3 full endings and
5 Learning Endings. Every number that can hurt you comes from real NASA data, and in Chapter 5 it
comes from today's Sun (NASA DONKI).

Built from *The Human Margin · Build guide* (13 November 2026).

## Run it

```sh
npm install
npm run dev        # play at the URL Vite prints
npm run build      # dist/index.html: one file, plays when opened straight from disk
npm test           # rules + story walker (about 1–2 minutes)
npm run e2e        # browser tests against dist/ (run `npm run build` first; uses installed Edge)
```

For `npm run e2e` with Chrome instead of Edge: `PW_CHANNEL=chrome npm run e2e`.

To ship: copy `dist/` (the HTML file plus `dist/assets/`) to GitHub Pages or itch.io.

## Art

All 9 backgrounds and 10 sprites are in `public/assets/`, renamed as in guide section 3, with the
section 3.4 fixes applied:

- `ama_s`, `ama_h`: white box and the 12-pixel grey stripe removed by flooding from the edges only.
- `bg01_bedroom`: see-through gaps filled with the darkest navy around them, (4, 5, 17).
- `sio_s`: skin colours only toned to match his other sprites (saturation ×0.86, brightness ×0.88).
- `sio_n`: padded from 902 to 909 pixels tall (at the top, so his feet stay put).
- `bg05_crater_rover`: scaled smoothly from 1672×941 to 1920×1080.

If an image goes missing, the game draws a labelled placeholder instead of breaking.
`node scripts/shoot-minigames.mjs <folder>` screenshots every minigame scene.

Layout change from guide 4.2: the radio insets are 200×200 at (48, 256) and (48, 516), below the
HUD, because the HUD wraps to a third row in Chapter 3 and covered an inset at (48, 120).

## NASA API key (card D8)

The live flare call uses `DEMO_KEY` unless you set your own key (guide 2.3):

```sh
echo VITE_NASA_API_KEY=your_key > .env.local
```

**Heads-up:** on 13 Nov 2026 the DONKI flare endpoint (`/DONKI/FLR`) returned **404** through
api.nasa.gov, while the CME, SEP, GST, IPS, RBE and HSS endpoints worked. Until it's back, every
run shows the **archived** 10 Sept 2017 X8.2 card (Shield needs 3 cubes), exactly as the guide's
fallback rule says. Test the call again before submitting.

## Project layout

```
story/            the script in ink (main.ink holds variables and helper functions)
src/engine/       story.ts runs ink and reads tags; rules.ts, outcomes.ts, save.ts, donki.ts, audio.ts
src/ui/           stage, scene, dialogue, choices, hud (+ reference chip), cards, menus
src/minigames/    the nine minigames; types.ts is the contract, kit.ts the shared helpers
src/data/         cards.json (D1–D8, ML1–ML11 word for word), refs.json, assets.json
tests/            rules.test.ts, walker.test.ts (every path), e2e/ (Playwright)
```

Writers edit `story/*.ink` as text; tags are listed at the top of `story/main.ink` and in
`src/engine/tags.ts`. A typo in a tag, an unknown sprite/background/card, or an old name
("Selene Ridge", "Okonkwo", …) fails `npm test`.

## Decisions taken (guide section 6)

The guide's recommended default was used everywhere. Overrule any of these by changing one place:

| Rule | What the game does | Where |
|---|---|---|
| R1 | Each chapter starts with that day's refill (10, Ch. 4: 7, Ch. 5: 10 or 8); unspent cubes don't carry over | `start_chapter` in main.ink |
| R2 | Reopened choices add up; unaffordable buttons are disabled; values clamped | choice knots |
| R4 | Gates check Learning Ending, then Storm Return, then Dark Return, then continue | `chN_gate` knots |
| R5 | IGNORED resets each chapter and counts risky picks only at amber/red reopenings | `risky()` |
| R6 | Doses round down (integer maths) | `storm_dose()` |
| R8 | 4.1 A plays B's line and card, not its trust | ch4.ink |
| R9 | Final Budget cubes are separate values (BUDGET_*) | finalBudget.ts |
| R10 | Snapshot before every choice and minigame; Learning Endings rewind to their scene | story.ts |
| R11 | Closing-line ties: Amara, then Sione, then Lucia | endings.ink |
| R12 | Shelter Drill 10 s / 20 s (fast: 7 s / 14 s) | shelterDrill.ts |
| P2 | **"Turn back now" costs 0 battery, not 2.** Tiles: lit 4%, shadow 8%, 5 steps | `TURN_COST` in main.ink, rules.ts |
| P3 | **Chapter 4 warnings follow the storm clock**: amber if anyone is still outside (first pick A or C), red if A again; A then reads "Finish the last row outside". 4.2 B uses up the day's cubes | ch4.ink |
| P4 | Kept: Chapter 5 can be unwinnable on an active-Sun day; the Final Budget says so plainly | finalBudget.ts |
| P5 | FOOD chip turns amber at 4 days or less, red below 3 | hud.ts |
| P6 | **STORM = 200 for Chapter 4**: DONKI lists 6 SEP events on 13 May 2024 (checked 13 Nov 2026) | `STORM_CH4` in main.ink |

Other choices the guide left open, worth a look:

- **Echo cards for 2.3 B and 4.1 A.** Core rule 4 says picking a risky option plays its Echo card in
  the debrief, so ML3 (Skylab 4) and ML6 (Gemini 8) now play at the end of Chapters 2 and 4 when
  picked. Without this, those two cards could never be shown.
- **3.2 C ("wait, then turn")** plays A's reaction but not A's trust, like R8.
- **4.3**: if 4.2 A was picked, the drill counts as late (0.8) unless the drill went worse. SHIELD
  also drops 10 after the Chapter 4 storm ("−10 after each storm"). Chapter 1's dose is added to
  CAREER too, so the Dose Log's career column includes both storms.
- **Launch Checklist**: one skip is forgiven; both skips set IGNORED = 2 (LE5).
- **"Go back to the last decision"** skips the flavour-only choice 5.4, which would change nothing.
- The 4.1 A echo tag line ("Gemini 8: find the cause before the fix.") is built from ML6's "What
  changed" line; the doc gives no tag line for it.
- Short UI banners (e.g. "Storm clock: 1 day left.", "Storm dose: 112 mSv.") mark warnings and
  results; they are not dialogue. Every line of dialogue is the guide's, word for word.
- The trust changes in 5.1 B are hidden from the cost line (trust is a hidden variable).

What the walker found: every ending is reachable (Ridge Dawn, Storm Return, Dark Return, LE1–LE5).
Storm Return only happens through Chapter 5; Chapters 1 and 4 can't produce it with the doc's
numbers (P1, P3), so those gate rows stay as safety nets. The Chapter 4 Dark Return row can't
trigger either (AIR never drops below 45 there).

## Before you submit (guide section 10)

1. Get a key at api.nasa.gov, set `VITE_NASA_API_KEY`, and check the FLR endpoint works again.
2. Done: STORM = 200 (see P6).
3. D1's CME IDs and D7's SEP ID are in the card small print. **Still to add:** the FLR IDs for D7
   (X8.7, 14 May 2024) and D8's backup (X8.2, 10 Sept 2017), which the 404 blocked.
4. Two lines still have no source and show no chip (`ref_needed` tags): the gold visor (Prologue)
   and "the magnetic field and the air stop its particles" (1.1, Storm Return debrief, LE1 lesson).
5. Design-choice numbers are listed on the in-game credits screen.
6. Credits screen: replace "The Human Margin art team" with the artists' names.
7. Optional art from guide 3.5: the crater image on the 8-pixel grid, and a concerned pose for Amara.
