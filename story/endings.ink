// ===================== ENDINGS =====================
// All three full endings close in BG01, the bedroom at home (no daytime art, so it is the first
// evening back), and finish on the Data Journal. "MIM-FULL": Mimi is heard, with no sprite.

=== storm_return ===
# ending: storm Storm Return
# scene: E.1 Storm Return
# bg: BG02
# show: L AMA-H
# show: R LUC-H
# hud: none
# ambient: drone
# sfx: alarm
AMARA: Doses are climbing faster than NASA's limit allows. We're leaving. No debate. # ref: D2
LUCIA: The seedlings...
AMARA: We'll plant new ones. Everyone goes home.
FADE: Halcyon lifts off. Meridian carries the crew home.
# bg: BG01
# hide: all
# ambient: theme
MIMI: You came back early! Is that bad?
YOU: It means we kept rule one.
(You hold out the figurine and let go in mid-air, as if it will float. It drops. Mimi catches it.) # ref: ML11
MIMI: You forgot gravity!
YOU: Everybody does.
# echo: ML11
DEBRIEF: What happened: the Shield was too thin for the storm.
DEBRIEF: Real world: the Moon has no magnetic field or air, so habitats need thick soil on the roof. # ref_needed: magnetic field and air
DEBRIEF: Replay hint: "What if you built the roof before the forecast came true?"
-> journal

=== dark_return ===
# ending: dark Dark Return
# scene: E.2 Dark Return
# bg: BG03R
# show: L SIO-C
# show: R AMA-D
# hud: none
# ambient: drone
SIONE: Power's thin and the air is falling. We're not in danger yet. We will be if we wait.
AMARA: Suit up. Essentials only. We're taking Halcyon up.
FADE: Headlamps in the dark. Then Earth, growing larger.
# bg: BG01
# hide: all
# ambient: theme
MIMI: You're doing the "I'm fine" face again.
(You stand up too fast and wobble. Mimi grabs your arm.) # ref: ML11
YOU: This one's my real face. A little dizzy, a lot glad.
# echo: ML11
DEBRIEF: What happened: Power, Air or Food ran out before the mission did.
DEBRIEF: Real world: missions keep a reserve and plan the way home before the way out.
DEBRIEF: Replay hint: "What if you kept three cubes spare every day?"
-> journal

=== ridge_dawn ===
# ending: dawn Ridge Dawn
# scene: E.3 Ridge Dawn
# bg: BG05
# hide: all
# hud: none
# ambient: theme
YOU (V.O.): We didn't beat the Moon. We read its data, learned from the crews before us, and traded carefully. Every cube had a cost, and we paid it.
FADE: Halcyon lifts off. Meridian. Splashdown.
# bg: BG01
MIMI (running in): Did you bring me a moon rock?
YOU: Moon rocks go to the scientists. But this was on my list.
(You hand her the gold-visored figurine. Your fingers open a moment too early. She catches it.) # ref: ML11
YOU: It's been to the Ridge.
MIMI (holding it up to the light): It looks the same.
YOU: It looks the same. It isn't.
// Closing line from CHOICE 5.4, spoken by the crewmate with the highest TRUST (ties: Amara, Sione, Lucia; rule R11).
{
- TRUST_AMARA >= TRUST_SIONE && TRUST_AMARA >= TRUST_LUCIA:
    AMARA (V.O.): {LAST_WORDS}
- TRUST_SIONE >= TRUST_LUCIA:
    SIONE (V.O.): {LAST_WORDS}
- else:
    LUCIA (V.O.): {LAST_WORDS}
}
# echo: ML11
SYSTEM: Mission complete.
-> journal

=== journal ===
# journal_screen
SYSTEM: Every number in this game came from NASA open data. Which one surprised you?
-> END
