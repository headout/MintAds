# Brag Plan: MintAds

## What is this app?
MintAds is an AI ad factory that turns any Headout experience ID into campaign-ready UGC-style video ads — 9:16, 1:1, 16:9 — with every on-screen claim traced to real catalog data, in ~3 minutes for ~$4.

## The angle
Headout has 10,000+ experiences. Fewer than 50 had dedicated ad creative — until now.
The video's premise: the problem is absurdly large, the solution is absurdly simple. One field. One button. Three minutes later, a video ad exists that didn't before. The creative angle is quiet confidence: we're not overselling a feature, we're showing a factory floor.

## Hook (first 2-3 seconds)
White screen. A single number types in: **"7148"** — the Colosseum experience ID — into the Experience ID field. No explanation yet. The number lands. Then the headline fades in above: **"10,000+ experiences."** A beat. **"One had an ad."**

## Key moments (the middle)
- The Generate form fills itself: persona, angle, hook selected one by one — each dropdown snaps in with a subtle sound. "Generate ad" button pulses and gets clicked.
- The Progress tracker runs live: five stage rows tick from pending → in_progress → completed (Content ingestion ✓ → Script ✓ → Video generation ✓ → Assembly ✓). The pipeline doing its thing.
- The Output page: a video player thumbnail appears (dark card, play icon), format badges pop in — **9:16 · 1:1 · 16:9**. Cost badge: **$4.12**. Duration: **2m 47s**.

## Outro / punchline
The Headout purple logo mark + "MintAds" wordmark fades in on a clean white field.
Final line beneath: **"Experience ID in. Video ad out."**
Subtext: **"Built by Rushi · Rohan · Gokul"**

## User flow worth showing
1. **Entry** — Experience ID typed into the Generate form, dropdowns selected (persona, angle, hook)
2. **Key action** — "Generate ad" clicked → Progress page: pipeline stages ticking through in real time
3. **Result** — Output page: video player card + format options + cost breakdown

## Tone
- Preset: `polished`
- Creative direction: quiet product demo — a factory floor, not a pitch deck
- Interpretation: Restrained pacing, clean typography, confidence through understatement. No hyperbole. The product does the talking. Every scene holds long enough to be read. Motion is purposeful, not decorative.

## Format: landscape — 1280x720
## Duration: 22 seconds

## Visual identity (from the project)
- Background: `#ffffff` (white)
- Accent: `#8000ff` (Headout signature purple)
- Text: `#111111`
- Secondary text: `#6b7280` (grey-3 equivalent)
- Display font: `halyard-display`, fallback `'DM Sans', sans-serif`
- Body font: `halyard-text`, fallback `'Inter', sans-serif`
- Strongest visual element: The purple CTA button and the Progress tracker stage rows with status icons

## Share copy (draft)
We gave every Headout experience an ad team. Drop in an experience ID, get a UGC-style video ad — 9:16, 1:1, 16:9 — in 3 minutes. MintAds.

## Audio direction
- Role: warm professional bed — present but never competing with the product
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` — clean, upbeat, corporate-adjacent without being generic
- Music treatment: fade in gently at 0.3s, sit at 0.5 volume throughout, fade out under final logo hold (last 2s)
- Music cue guidance: bundled preset at ~110 BPM. Target strong cue at **20.19s** for the output/logo reveal. Use beat grid (~0.55s intervals) for the sequential dropdown selections and stage completions.
- Audio-reactive treatment: subtle — use music RMS to add gentle glow/presence breathing on the purple accent button and the stage completion checkmarks. No waveform visuals.
- SFX posture: sparse, professional. Motion-matched.
- Audio-coupled moments:
  - Hook typing — subtle key tick per character as "7148" types in
  - Dropdown selections — light card/select sound per item (3 selections)
  - "Generate ad" button click — clean click/confirm sound
  - Each stage row completing — soft tick or check sound (5 rows)
  - Format badges appearing — three quick soft pops
  - Logo reveal — single clean announcement chime
- Restraint rule: no swooshes, no heavy transitions. SFX should feel like a real UI, not a game.

---

## Storyboard

### Scene 1 — Hook — 4s
**Black text on white.** A large, confident headline fades in: `"10,000+ experiences."` holds 1.2s. Then a hard cut to a second line below it: `"Fewer than 50 had an ad."` holds 1.2s. Slight fade-to-next. This is the problem, stated without drama.
Sequential/interaction: yes — two text lines reveal sequentially, second line after first settles
Audio intent: music eases in under the silence, setting tone
Audio-coupled idea: each headline line fades in on a beat
Music: warm bed builds gently
Transition mood: clean fade → Scene 2

### Scene 2 — The Input — 5s
**The MintAds Generate form** — a faithful HTML recreation using the Headout purple/white palette. The Experience ID field is empty. The number `7148` types in character by character (key ticks). Then three dropdowns below snap into place one by one: **Solo Traveller** → **Curiosity** → **Storyteller hook**. Each selection arrives with a subtle select sound. The purple **"Generate ad"** button is visible at the bottom, glowing very slightly with audio reactivity.
Sequential/interaction: yes — typing animation, then 3 dropdowns select sequentially
Audio intent: playful, purposeful — UI sounds make it feel real and fast
Audio-coupled idea: key ticks on typing, card sound per dropdown, beat-aligned to the beat grid
Music: steady bed
Transition mood: button click sound + soft wipe → Scene 3

### Scene 3 — The Pipeline — 6s
**The Progress tracker.** Five stage rows, initially all pending (grey clock icons). They tick through one by one, each flipping from pending → in_progress (spinner) → completed (purple checkmark):
1. Content ingestion ✓
2. Script generation ✓
3. Video generation ✓
4. Assembly ✓
5. Export ✓
Each completion has a soft tick SFX. The stage labels use the real app copy. A subtle cost counter ticks up in the corner: `$0.00 → $4.12`.
Sequential/interaction: yes — 5 rows complete sequentially, each with tick sound
Audio intent: builds momentum — each tick is satisfying, like a checklist completing
Audio-coupled idea: each stage completion beat-aligned; cost counter ticks subtly
Music: stays steady, slight energy build
Transition mood: all green, clean slide → Scene 4

### Scene 4 — The Output — 5s
**The Output page.** A dark video player card slides in — thumbnail area with a play button icon. Below it, three format badge pills pop in sequentially: **9:16** · **1:1** · **16:9** (each with a small soft pop sound). A cost card appears to the right: **$4.12 total** with a small breakdown. A duration line: **2m 47s**. Everything uses the real UI copy and layout feel.
Sequential/interaction: yes — player card slides in, then 3 format badges pop in one by one
Audio intent: payoff — the product delivered
Audio-coupled idea: badge pops beat-locked to strong cue at ~20.19s
Music: building toward the outro
Transition mood: soft crossfade → Scene 5

### Scene 5 — Logo / Outro — 2s
**Clean white.** The Headout purple `#8000ff` `MintAds` wordmark fades in, centred. One line below in grey: **"Experience ID in. Video ad out."** A single clean chime. Music fades.
Sequential/interaction: none
Audio intent: landing — clean, confident close
Audio-coupled idea: chime on logo reveal
Music: fade out
Transition mood: end

**Music mood for this video:** upbeat professional — warm, forward-moving, never distracting
**Audio summary:** music enters gently on Scene 1, builds quietly through the pipeline, peaks at the output reveal beat-lock, and fades cleanly under the logo — SFX layer gives the UI its heartbeat.
