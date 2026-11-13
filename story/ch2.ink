// ===================== CHAPTER 2: BREATHE =====================
// Data: D3, D4. Echo: ML2, ML3.
// AIR to CO2 for the tooltip: CO2 (mmHg) = 7 − AIR/10.

=== ch2 ===
~ start_chapter(2)
# chapter: 2 Breathe
# scene: 2.1 Morning Check
# bg: BG03
# show: L SIO-N
# show: R AMA-N
# ambient: fans
# hud: POWER AIR SHIELD
# call: curious
MIMI: Why can't you just open a window?
SIONE: Because outside is empty, Mimi. Each of us breathes out about 350 litres of carbon dioxide a day. Four of us, every day. # ref: D3
# card: D3
SIONE: A little gives you a headache. More makes you slow and tired. Machines called scrubbers pull it out, and scrubbers cost Power. # ref: D3
# hud: +FOOD
AMARA: Which is why the air check happens before breakfast. Every day.
-> ch2_2

=== ch2_2 ===
# scene: 2.2 Seedlings
# bg: BG04
# show: C LUC-D
# ambient: theme
LUCIA: Food lasts eight more days. Resupply is three weeks out. So we grow.
# card: D4
LUCIA: Astronauts on the space station grew lettuce and ate it in 2015. NASA put every result in an open archive called OSDR. Anyone can read it. Even you, Mimi. # ref: D4
# call: curious
MIMI: Can I eat one?
LUCIA: Not yet. Give them light now and they'll feed us in two weeks. Light costs Power.
+ [Full grow lights #title: Grow Lights #fx: POWER −3, HARVEST = 6 days, SCIENCE +10]
    ~ spend(3)
    ~ HARVEST = 6
    ~ SCIENCE = SCIENCE + 10
    ~ TRUST_LUCIA = TRUST_LUCIA + 1
    # swap: LUC-N
    LUCIA: "They'll be enormous."
+ [Half lights #title: Grow Lights #fx: POWER −1, HARVEST = 3 days]
    ~ spend(1)
    ~ HARVEST = 3
    # swap: SIO-S
    SIONE: "Enough to eat. Not enough to show off."
+ [Lights off for now #title: Grow Lights #fx: POWER 0, HARVEST = 0]
    ~ HARVEST = 0
    ~ floor0(TRUST_LUCIA, -1)
    LUCIA: "Then we'd better ration."
-
# call: end
-> ch2_3

=== ch2_3 ===
~ WARN = 0
# scene: 2.3 The Drift
# bg: BG03
# show: L AMA-D
# show: C SIO-C
# show: R LUC-C
# ambient: fans
~ AIR = 42
AMARA: CO2 is creeping. If it keeps going, we swap a scrubber now.
LUCIA: It's under NASA's line. And swapping means shutting off my lights. # ref: D3
SIONE: Anyone else getting a headache?
LUCIA: Long day. That's all.
AMARA: That's what tired crews say. Skylab 4's schedule was so packed they kept falling behind and making small mistakes, until they told Mission Control the truth. # ref: ML3
-> air

= air
+ [Swap the scrubber now #title: The Air #fx: POWER −3, AIR +25, Science paused 1 day]
    ~ spend(3)
    ~ add_air(25)
    ~ SWAP_TIME = 60
    ~ TRUST_AMARA = TRUST_AMARA + 1
    # swap: AMA-S
    AMARA: "Good call."
+ [Wait and watch #title: The Air #fx: AIR −10 by tomorrow, SCIENCE +15 #echo_tag: ML3 Skylab 4: a tired crew kept pushing until the mistakes piled up.]
    ~ risky()
    ~ PICKED_ML3 = true
    ~ add_air(-10)
    ~ SCIENCE = SCIENCE + 15
    LUCIA: "See? Fine."
+ [Dim every light, grow lights too #title: The Air #fx: POWER −2, AIR +15, HARVEST −2]
    ~ spend(2)
    ~ add_air(15)
    ~ floor0(HARVEST, -2)
    ~ CHOSE_C = true
    SIONE: "Dark, but breathing."
-
{ WARN == 0 && AIR < 40:
    -> amber
}
{ WARN == 1 && AIR < 25:
    -> red
}
-> ch2_4

= amber
~ WARN = 1
# warn: amber
SIONE: "My head's pounding. That's not the long day."
-> air

= red
~ WARN = 2
# warn: red
# sfx: alarm
AMARA: "Swap it. Now."
-> air

=== ch2_4 ===
# scene: 2.4 Scrubber Swap
# bg: {AIR < 25:BG03R|BG03}
# show: C SIO-C
# ambient: tick
# echo: ML2
SIONE: Apollo 13 had spare canisters. Square ones. The sockets were round. Match the shapes, and no forcing. # ref: ML2 # minigame: scrubber_swap
{ SWAP_OK:
    ~ add_air(25)
    ~ TRUST_AMARA = TRUST_AMARA + 1
    ~ TRUST_LUCIA = TRUST_LUCIA + 1
    ~ TRUST_SIONE = TRUST_SIONE + 1
    # ambient: fans
    # swap: SIO-N
    SYSTEM: Scrubber swapped: AIR +25.
- else:
    # ambient: drone
    SYSTEM: The swap failed twice.
}
~ floor0(FOOD, -2)
# {PICKED_ML3:echo: ML3}
# journal: D3 D4 ML2 ML3
SYSTEM: Food: −2 days.
-> ch2_gate

=== ch2_gate ===
{
- IGNORED >= 2 && SWAP_FAILED:
    -> le2
- AIR < 40:
    -> dark_return
- else:
    -> ch3
}
