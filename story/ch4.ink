// ===================== CHAPTER 4: DUST AND DARK =====================
// Data: D6, D7, D2. Echo: ML6, ML7, ML8.
// Guide P3 (recommended): the doc's amber ("POWER below 3") can never fire, so the warning is tied to the
// storm clock as in Chapter 1. Amber = particles one hour out, while anyone is still outside (first pick A or C).
// Red = the shelter alarm, if A was picked again at amber; A then reads "Finish the last row outside".
// 4.2 B's "POWER 0" is read as "uses up the day's cubes" (riding it out on batteries).

=== ch4 ===
~ start_chapter(4)
# chapter: 4 Dust and Dark
# scene: 4.1 Gray Panels
# bg: BG02
# show: C SIO-H
# inset: LUC-C AMA-D
# ambient: hum
# hud: POWER AIR SHIELD FOOD
~ POWER_REFILL = 7
SYSTEM: Power refill today: 7 cubes. # ref: D6
SIONE: Power dropped by a third overnight.
LUCIA (radio): It's my lab. Something's faulty in there. Let me reboot everything.
AMARA (radio): On Gemini 8, Armstrong and Scott thought the other spacecraft was making them spin, so they undocked. The spin got faster. The real problem was on their own capsule. Find the cause first. # ref: ML6
+ [Reboot the lab #title: The Cause #fx: POWER −1, nothing improves #echo_tag: ML6 Gemini 8: find the cause before the fix.]
    ~ spend(1)
    ~ PICKED_ML6 = true
    LUCIA (radio): "...It didn't help."
    // Then B plays: its reaction line and card, not its TRUST_AMARA +1 (rule R8).
    SIONE: "Found it."
+ [Go look at the panels first #title: The Cause #fx: No cost]
    ~ TRUST_AMARA = TRUST_AMARA + 1
    SIONE: "Found it."
-
# card: D6
SIONE: Dust. Apollo crews said it clung to everything. After Apollo 17, Harrison Schmitt said the dust in the cabin gave him something like hay fever. It's sitting on our panels. # ref: D6
SIONE: Clip your brush to your suit. On a space shuttle mission in 2008, a tool bag floated away while an astronaut was cleaning up a grease leak. Here, it would just roll into the crater. # ref: ML7
# echo: ML7
SYSTEM: Sweep the panels. # minigame: dust_sweep
SYSTEM: Tomorrow's Power refill: {POWER_REFILL}.
-> ch4_2

=== ch4_2 ===
~ WARN = 0
~ OUTSIDE = false
# scene: 4.2 Two Problems at Once
# bg: BG03
# show: L AMA-D
# show: C SIO-N
# show: R LUC-C
# hideinset
# sfx: chime
# ambient: hum
~ FOOD = FOOD + HARVEST
SYSTEM: Harvest: FOOD +{HARVEST} days.
# swap: LUC-N
LUCIA (a small smile): The lettuce is ready. It's bitter, and it's ours.
# card: D7
AMARA: Biggest flare of that whole storm, and the cloud misses us. The particles might not. They can follow the Sun's magnetic field around to us. # ref: D7
AMARA: In 1997, a supply ship hit the Mir space station. The crew sealed off the damaged module, and its solar panels went with it. They had minutes to choose what stayed on. We'll choose now. # ref: ML8
# echo: ML8
SYSTEM: Put the systems in order. Power runs out from the bottom up. # minigame: power_triage
-> storm

= storm
+ {WARN < 2} [Clear the rest of the panels outside #title: Before the Storm #fx: POWER −2, POWER_REFILL 10, drill counts as late (0.8)]
    ~ pick_a()
    SIONE: "I'll be quick."
+ {WARN == 2} [Finish the last row outside #title: Before the Storm #fx: POWER −2, POWER_REFILL 10, drill counts as late (0.8)]
    ~ pick_a()
    SIONE: "I'll be quick."
+ [Ride it out on batteries #title: Before the Storm #fx: Uses the day's remaining POWER, AIR −10 (heaters rationed), Science paused]
    ~ LAST_PICK = "B"
    ~ POWER = 0
    ~ add_air(-10)
    ~ TRUST_AMARA = TRUST_AMARA + 1
    AMARA: "Cold, but safe."
+ [Clear half, then shelter #title: Before the Storm #fx: POWER −1, POWER_REFILL 9]
    ~ LAST_PICK = "C"
    ~ spend(1)
    { POWER_REFILL < 9:
        ~ POWER_REFILL = 9
    }
    SIONE: "Half a job, whole crew."
-
{ WARN == 0 && LAST_PICK != "B":
    -> amber
}
{ WARN == 1 && LAST_PICK == "A":
    -> red
}
-> ch4_3

= amber
~ WARN = 1
# warn: amber
SYSTEM: Storm clock: particles one hour out.
SIONE: "Heaters are next."
-> storm

= red
~ WARN = 2
# warn: red
# sfx: alarm
AMARA: "Inside. Now."
-> storm

=== function pick_a()
~ LAST_PICK = "A"
~ risky()
~ spend(2)
~ POWER_REFILL = 10
~ OUTSIDE = true

=== ch4_3 ===
# scene: 4.3 Dose Log
# bg: BG03R
# show: L AMA-N
# show: R SIO-C
# ambient: drone
# sfx: alarm
# minigame: shelter_drill fast
SYSTEM: Shelter drill. Faster this time.
// 4.2 A: the drill counts as late (0.8), unless it went worse than that.
{ OUTSIDE && DRILL < 8:
    ~ DRILL = 8
}
~ DOSE = storm_dose(STORM_CH4)
~ CAREER = CAREER + DOSE
{ STORM_CH4 > 0:
    ~ add_shield(-10)
}
# call: worried
MIMI: How do you even know how much radiation you got?
SIONE: Each of us wears a little badge that measures it. NASA keeps every astronaut's total. Nobody gets more than 600 millisieverts in a whole career. # ref: D2 # minigame: dose_log
# call: end
~ floor0(FOOD, -2)
# {PICKED_ML6:echo: ML6}
# journal: D6 D7 ML6 ML7 ML8
SYSTEM: Food: −2 days.
-> ch4_gate

=== ch4_gate ===
{
- IGNORED >= 2 && TRIAGE_WRONG:
    -> le4
- DOSE >= 250:
    -> storm_return
- POWER == 0 && AIR < 40:
    -> dark_return
- else:
    -> ch5
}
