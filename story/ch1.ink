// ===================== CHAPTER 1: THE STORM CARD =====================
// Data: D1, D2. Echo: ML1.

=== ch1 ===
~ start_chapter(1)
# chapter: 1 The Storm Card
# scene: 1.1 First Light
# bg: BG02
# show: L AMA-N
# show: R SIO-N
# ambient: hum
# hud: POWER AIR SHIELD
AMARA: Habitat's stable. We get ten Power cubes a day. Every cube you spend here is one you don't have somewhere else.
SIONE: Air to breathe. Shield against radiation. Science, which is why we came. You can't fill all three.
# call: curious
MIMI: Is it scary up there?
SIONE: The scary part isn't the Moon, Mimi. It's the Sun. On Earth, the magnetic field and the air stop its particles. The Moon has neither. # ref_needed: magnetic field and air
-> ch1_2

=== ch1_2 ===
~ WARN = 0
# scene: 1.2 The Storm Card
# bg: BG03
# show: L AMA-D
# show: C SIO-N
# show: R LUC-N
# sfx: chime
# ambient: hum
# card: D1
GROUND (V.O.): This is a replay of a real storm from May 2024. The clouds took two days to cross 150 million kilometres. The Moon is right next to Earth, so you get it at the same time. # ref: D1
AMARA: And the fastest particles don't wait for the cloud. They can arrive within an hour. We drill the shelter today. # ref: NWS
# call: curious
MIMI: What does "S2" mean?
SIONE: It's a radiation storm score from 1 to 5. Two means real trouble for anyone without a thick roof. # ref: D1
# swap: LUC-C
LUCIA: Building that roof freezes my experiment for two days. Those samples took years to prepare.
AMARA: Apollo 12 launched into storm clouds because the schedule said go. Lightning hit the rocket twice. # ref: ML1
LUCIA: And they made it.
AMARA: Because one controller remembered one switch from training. I'd rather not need a miracle. # ref: ML1
SIONE (to you): You hold the cubes.
-> roof

= roof
+ [Build the full roof #title: The Roof #fx: POWER −6, SHIELD +40, Science paused 2 days]
    ~ spend(6)
    ~ add_shield(40)
    ~ TRUST_AMARA = TRUST_AMARA + 1
    # swap: AMA-S
    AMARA: "Thank you."
+ [Science first, roof later #title: The Roof #fx: POWER −2, SHIELD +10, SCIENCE +20 #echo_tag: ML1 Apollo 12 also flew into the forecast.]
    ~ risky()
    ~ spend(2)
    ~ add_shield(10)
    ~ SCIENCE = SCIENCE + 20
    ~ TRUST_LUCIA = TRUST_LUCIA + 1
    LUCIA: "Two days. That's all I need."
+ [Split it #title: The Roof #fx: POWER −4, SHIELD +25, SCIENCE +10]
    ~ spend(4)
    ~ add_shield(25)
    ~ SCIENCE = SCIENCE + 10
    # swap: SIO-S
    SIONE: "The middle path. I like it."
-
{ WARN == 0 && SHIELD < 25:
    -> amber
}
{ WARN == 1 && SHIELD < 25:
    -> red
}
-> ch1_3

= amber
~ WARN = 1
# warn: amber
SYSTEM: Storm clock: 1 day left.
AMARA: "The forecast hasn't changed. Neither has the roof."
-> roof

= red
~ WARN = 2
# warn: red
# sfx: alarm
SYSTEM: Particles arriving.
-> roof

=== ch1_3 ===
# scene: 1.3 Shelter Drill
# bg: BG03R
# show: C SIO-C
# ambient: drone
# sfx: alarm
# minigame: shelter_drill
SYSTEM: Shelter drill. Get the crew in, then switch off what you don't need.
~ SHIELD_AT_STORM = SHIELD
~ DOSE = storm_dose(STORM)
~ CAREER = CAREER + DOSE
# ambient: none
SIONE: Badges on. NASA allows 250 millisieverts for one storm and 600 for a whole career. We log every one. # ref: D2
# card: D2
SYSTEM: Storm dose: {DOSE} mSv. # ref: D2
-> ch1_4

=== ch1_4 ===
# scene: 1.4 Debrief
# bg: BG03
# show: L AMA-N
# show: R LUC-N
# ambient: piano
# call: happy
# echo: ML1
MIMI: So thick dirt is like a blanket?
YOU: A very heavy blanket.
~ add_shield(-10)
~ floor0(FOOD, -2)
# journal: D1 D2 ML1
# call: end
SYSTEM: The soil settles: SHIELD −10. Food: −2 days.
-> ch1_gate

// Chapter 1 gate, checked in rule R4's order: Learning Ending, Storm Return, Dark Return, continue.
=== ch1_gate ===
{
- IGNORED >= 2 && DRILL == 10:
    -> le1
- DOSE >= 250:
    -> storm_return
- else:
    { SHIELD_AT_STORM < 25:
        ~ floor0(TRUST_AMARA, -1)
    }
    -> ch2
}
