// THE HUMAN MARGIN · story entry point.
// Script: "Selene Ridge: Game Script (Lean Build)" as adjusted in the build guide, Appendix A.
// Tags are read by the engine (src/engine/tags.ts lists every one). Line format:
//   SPEAKER: text            nameplate + line
//   SPEAKER (radio): text    radio line (antenna icon); any other (...) is a stage direction
//   (Stage direction.)       narration in italics, no nameplate
//   SYSTEM: text             alert banner (no nameplate)
//   LESSON: / QUESTION:      Learning Ending cards
// Choices: + [Button #fx: effect text #echo_tag: ML1 #title: Choice title]
// Numbers that are design choices (not from the doc) are marked DESIGN.

INCLUDE prologue.ink
INCLUDE ch1.ink
INCLUDE ch2.ink
INCLUDE ch3.ink
INCLUDE ch4.ink
INCLUDE ch5.ink
INCLUDE endings.ink
INCLUDE learning.ink

// ---------- Variables (Appendix A, "Variables") ----------
VAR CHAPTER = 0
VAR POWER = 10
VAR POWER_REFILL = 10
VAR AIR = 60
VAR SHIELD = 0
VAR FOOD = 10
VAR SCIENCE = 0
VAR BATTERY = 100
VAR DOSE = 0
VAR CAREER = 0
VAR TRUST_AMARA = 2
VAR TRUST_LUCIA = 2
VAR TRUST_SIONE = 2
VAR IGNORED = 0

// ---------- Working variables ----------
VAR WARN = 0                 // 0 = first opening, 1 = amber reopening, 2 = red reopening
VAR STORM = 300              // card D1: storm strength 300
VAR STORM_CH4 = 200          // card D7 dev flag: DONKI lists SEP events on 13 May 2024 (checked 13 Nov 2026), so 200
VAR DRILL = 10               // shelter drill multiplier in tenths: 5 perfect, 8 late, 10 failed or skipped
VAR SHIELD_AT_STORM = 0
VAR HARVEST = 0
VAR SWAP_TIME = 30
VAR SWAP_OK = false
VAR SWAP_FAILED = false
VAR CHOSE_C = false
VAR OUTBOUND_COST = 40
VAR SHADOW_TILES = 0
VAR SAMPLE = 0
VAR DRILL_LATE = false
VAR TURN_COST = 0            // guide P2 recommendation: "Turn back now" costs 0 (the doc said 2)
VAR TRIAGE_WRONG = false
VAR OUTSIDE = false
VAR LAST_PICK = ""
VAR SHIELD_LINE = 3          // set by the engine from card D8 (3 X-class / archived, 2 M-class, 1 quieter)
VAR D8_CLASS = "X8.2"
VAR D8_SOURCE = "ARCHIVED"
VAR D8_FETCHED = ""
VAR BUDGET_AIR = 0
VAR BUDGET_SHIELD = 0
VAR BUDGET_LAUNCH = 0
VAR SOUVENIR_B = false
VAR PICKED_ML3 = false      // core rule 4: picking a risky option plays its Echo card in the debrief
VAR PICKED_ML6 = false
VAR LAST_WORDS = ""

-> prologue

// ---------- Helpers ----------
=== function clamp(x, lo, hi)
{ x < lo:
    ~ return lo
}
{ x > hi:
    ~ return hi
}
~ return x

=== function spend(n)
~ POWER = clamp(POWER - n, 0, 99)

=== function add_air(n)
~ AIR = clamp(AIR + n, 0, 100)

=== function add_shield(n)
~ SHIELD = clamp(SHIELD + n, 0, 100)

=== function add_battery(n)
~ BATTERY = clamp(BATTERY + n, 0, 100)

=== function floor0(ref x, n)
~ x = x + n
{ x < 0:
    ~ x = 0
}

// Rule R5: counts a risky pick only at the amber or red reopening.
=== function risky()
{ WARN > 0:
    ~ IGNORED = IGNORED + 1
}

// DOSE = STORM × (1 − SHIELD/100) × drill, rounded down (rule R6). Integer maths.
=== function storm_dose(strength)
~ return (strength * (100 - SHIELD) * DRILL) / 1000

// Rule R1: each chapter starts with that day's refill; IGNORED resets (rule R5).
=== function start_chapter(n)
~ CHAPTER = n
~ IGNORED = 0
~ WARN = 0
{ n <= 3:
    ~ POWER = 10
}
{ n == 4:
    ~ POWER = 7
}
{ n == 5:
    ~ POWER = 8
    { POWER_REFILL >= 9:
        ~ POWER = 10
    }
}
