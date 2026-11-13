// ===================== CHAPTER 5: RIDGE DAWN =====================
// Data: D8 (LIVE). Echo: ML9, ML10.

=== ch5 ===
~ start_chapter(5)
# chapter: 5 Ridge Dawn
# scene: 5.1 Packing
# bg: BG03
# show: L AMA-N
# show: C SIO-N
# show: R LUC-N
# ambient: piano
# hud: POWER AIR SHIELD FOOD
SYSTEM: Power refill today: {POWER} cubes.
LUCIA (sealing a small case): Seedlings, the ice sample, the dose logs. Years of work in a box the size of a lunchbox.
# call: happy
MIMI: I told my whole class about you!
LUCIA (holding out a tiny vial of gray dust): For your sister. Nobody would ever know.
+ [Only what's on the approved list #title: The Souvenir #fx: No cost]
    ~ TRUST_AMARA = TRUST_AMARA + 1
    # swap: AMA-S
    AMARA: "Good."
+ [Slip the dust into your kit #title: The Souvenir #fx: No Power cost #echo_tag: ML9 Apollo 15: unapproved envelopes, and three careers over.]
    ~ SOUVENIR_B = true
    ~ floor0(TRUST_AMARA, -2)
    ~ floor0(TRUST_SIONE, -1)
    AMARA: "The Apollo 15 crew carried things that weren't on the list. None of them flew again." # ref: ML9
+ [Ask Ground to add a sample to the official cargo #title: The Souvenir #fx: SCIENCE +5]
    ~ SCIENCE = SCIENCE + 5
    ~ TRUST_LUCIA = TRUST_LUCIA + 1
    LUCIA: "The proper way. Fine."
-
// ECHO ML9 plays only if B was chosen; otherwise it is added to the Journal at the end (5.4).
# {SOUVENIR_B:echo: ML9}
YOU (holding up the figurine): This is the only thing I'm bringing you. It's on the list.
# call: end
-> ch5_2

=== ch5_2 ===
# scene: 5.2 The Last Forecast
# bg: BG03
# show: L SIO-N
# show: R AMA-D
# sfx: chime
# ambient: hum
# fetch_donki
# card: D8
AMARA: This one isn't a replay. That's today's Sun. # ref: D8
# call: curious
MIMI: Right now? The real one?
SIONE: Right now, Mimi. NASA posts every flare it sees. Anyone can look. # ref: D8
# call: end
AMARA: Three jobs tonight. Air until morning. A roof sized for that card. And a full charge for Halcyon to get us off the Moon. Nothing can be zero. # minigame: final_budget
-> ch5_3

=== ch5_3 ===
# scene: 5.3 The Checklist
# bg: BG03
# show: C AMA-D
# ambient: tick
AMARA (holding a small card): Apollo 13's explosion started on the ground, years before launch. A tank was dropped five centimetres. A switch rating nobody checked. Read it with me. # ref: ML10
# echo: ML10
SYSTEM: Launch checklist. Eight steps, in order. # minigame: launch_checklist
# ambient: none
-> ch5_4

=== ch5_4 ===
# scene: 5.4 The Last Look
# bg: BG05
# ambient: theme
SIONE (V.O.): I keep thinking it should feel bigger. # {not SOUVENIR_B:journal: ML9}
AMARA (V.O.): That's what it feels like when nothing's broken.
+ ["We read the data and we listened." #title: Last Words #fx: Sets the closing line]
    ~ LAST_WORDS = "We read the data and we listened."
+ ["We took care of each other." #title: Last Words #fx: Sets the closing line]
    ~ LAST_WORDS = "We took care of each other."
+ ["Let's come back." #title: Last Words #fx: Sets the closing line]
    ~ LAST_WORDS = "Let's come back."
-
-> ch5_gate

=== ch5_gate ===
{
- IGNORED >= 2:
    -> le5
- BUDGET_SHIELD < SHIELD_LINE:
    -> storm_return
- BUDGET_AIR < 3 || BUDGET_LAUNCH < 4 || FOOD < 3:
    -> dark_return
- else:
    -> ridge_dawn
}
