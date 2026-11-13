// ===================== CHAPTER 3: THE ICE RUN =====================
// Data: D5. Echo: ML4, ML5.
// Guide P2 (recommended, one number changed): "Turn back now" costs 0, not 2 (TURN_COST in main.ink).
// Route Planner tile costs (DESIGN): lit 4%, shadow 8%, 5 steps, so routes cost 20–40%.

=== ch3 ===
~ start_chapter(3)
~ BATTERY = 100
# chapter: 3 The Ice Run
# scene: 3.1 The Plan
# bg: BG05
# show: R LUC-H
# inset: AMA-N
# ambient: wind
# hud: POWER AIR SHIELD FOOD BATTERY
LUCIA: Water ice, somewhere down there. Every litre we find is a litre nobody has to launch from Earth. And water can be split into oxygen.
# call: curious
MIMI: Why does ice hide in the dark?
# card: D5
LUCIA: Sunlight never reaches the floor of some craters. NASA's Lunar Reconnaissance Orbiter measured it: colder than minus 230 degrees. Ice can last there for a very long time. # ref: D5
AMARA (radio): Shadow tiles cost double, because the rover runs its heaters. Rule: turn back at 60 percent. Forty out, forty back, twenty for surprises. # ref: D5
MIMI: Why not use all the battery going there?
YOU: Because then the way home is a very long walk. # minigame: route_planner
# call: end
SYSTEM: Route locked: {OUTBOUND_COST}% out, {OUTBOUND_COST}% back.
-> ch3_2

=== ch3_2 ===
~ WARN = 0
# scene: 3.2 Blackout
# bg: BG06
# show: C LUC-H
# hideinset
# ambient: static
# sfx: static
# timer: COMMS LOST 3:00
LUCIA: The crater wall's blocking the base. And Earth's sitting low on the horizon this week anyway. It's just us. # ref: COMMS
YOU: Like Soyuz 5. One cosmonaut, a capsule coming in backwards, nobody he could call. # ref: ML5
LUCIA: What did he do?
YOU: Stuck to his procedures. And lived.
# echo: ML5
# ambient: none
SYSTEM: Drill the sample. Release when the heat peaks. # minigame: drill_sample
~ BATTERY = 60
{ DRILL_LATE:
    ~ add_battery(-2)
}
// The choice opens at amber (60%), so the first pick already counts as a warning pick (rule R5).
~ WARN = 1
# warn: amber
# inset: AMA-N
# sfx: static
AMARA (radio crackles back): "Sixty. That's the line."
-> turn

= turn
+ [Turn back now #title: The Turn #fx: Sample kept]
    ~ add_battery(-TURN_COST)
    ~ TRUST_AMARA = TRUST_AMARA + 1
    LUCIA: "Okay. Okay. We go home."
    -> ch3_3
+ [One more sample #title: The Turn #fx: BATTERY −10, SCIENCE +15 #echo_tag: ML4 Apollo 11 landed with Mission Control counting the fuel out loud.]
    ~ risky()
    ~ add_battery(-10)
    ~ SCIENCE = SCIENCE + 15
    LUCIA: "Two minutes. I promise."
+ [Wait for the radio, then ask #title: The Turn #fx: BATTERY −5 (heaters while waiting), then turn]
    ~ add_battery(-5)
    LUCIA: "Fine. We ask."
    AMARA (radio): "Turn."
    // A plays: its reaction, not its trust (as rule R8 does for 4.1).
    ~ add_battery(-TURN_COST)
    LUCIA: "Okay. Okay. We go home."
    -> ch3_3
-
{ WARN == 1 && BATTERY <= 50:
    -> red
}
-> ch3_3

= red
~ WARN = 2
# warn: red
# sfx: alarm
LUCIA: "We're past the line."
-> turn

=== ch3_3 ===
# scene: 3.3 The Way Home
# bg: BG05
# show: R LUC-H
# inset: AMA-D
# timer: off
# ambient: theme
~ add_battery(-OUTBOUND_COST)
SYSTEM: The drive home costs {OUTBOUND_COST}%. Battery at base: {BATTERY}%.
AMARA (radio): On Apollo 11, Mission Control counted the fuel down out loud. "Sixty seconds." "Thirty seconds." I counted yours the same way. # ref: ML4
# echo: ML4
# call: happy
MIMI: You found ice? Real ice?
LUCIA (holding up a frosted vial): Real ice. It'll be air soon.
# call: end
~ floor0(FOOD, -2)
# journal: D5 ML4 ML5
SYSTEM: Food: −2 days.
-> ch3_gate

=== ch3_gate ===
{
- IGNORED >= 2 && BATTERY <= 0:
    -> le3
- BATTERY < 20:
    -> dark_return
- else:
    ~ add_air(15)
    SYSTEM: Ice becomes oxygen: AIR +15.
    -> ch4
}
