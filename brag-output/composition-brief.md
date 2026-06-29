# Hyperframes Composition Brief: MintAds

## Objective
Create a 22-second polished product demo video for MintAds — an AI-powered ad factory that turns a Headout experience ID into campaign-ready UGC video ads in ~3 minutes.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1280×720
- Duration: 22 seconds

## Source Material
- Project root: `/Users/apple/Desktop/MintAds - Headout/`
- Primary files read: `README.md`, `frontend/src/pages/Generate.tsx`, `Progress.tsx`, `Output.tsx`, `frontend/src/styles/ds/colors_and_type.css`
- Product name: MintAds
- Tagline / strongest claim: "10,000+ experiences. Fewer than 50 had an ad."
- Key UI moments to recreate: Generate form (Experience ID field + dropdowns + CTA button), Progress tracker (5 stage rows with status icons), Output page (video player card + format badges + cost card)
- Copy that must appear verbatim:
  - "10,000+ experiences."
  - "Fewer than 50 had an ad."
  - "Experience ID in. Video ad out."
  - Stage labels: "Content ingestion", "Script generation", "Video generation", "Assembly", "Export"
  - Format labels: "9:16", "1:1", "16:9"

## Creative Direction
- Tone preset: `polished`
- Creative direction: quiet factory floor — confidence through understatement
- Interpretation: Restrained pacing, clean white/purple palette, purposeful motion. No hyperbole. Every text line holds long enough to be fully read. Fast-in animations, then hold. No decorative motion.
- Angle: The problem (10,000 experiences, no ads) stated plainly. The solution (type an ID, get a video) shown in action. The pipeline is the product.
- Hook: Headline reveals "10,000+ experiences." then "Fewer than 50 had an ad." — the problem in 4 seconds
- Outro: Clean white, purple MintAds wordmark, "Experience ID in. Video ad out." + "Built by Rushi · Rohan · Gokul"
- Avoid: Generic SaaS language, abstract filler visuals, purple gradients that don't match the real UI

## Visual Identity
- Background: `#ffffff`
- Text: `#111111`
- Accent / primary: `#8000ff` (Headout signature purple)
- Secondary text: `#6b7280`
- Border / divider: `#e5e7eb`
- Display font: `'DM Sans', sans-serif` (halyard-display fallback — use DM Sans as web-safe substitute)
- Body font: `'Inter', sans-serif` (halyard-text fallback)
- Visual references: Purple filled button, stage rows with left-side status icon + label + right-side cost/duration meta, pill-shaped format badges

## Storyboard
Scene summary:
1. **Hook** — 4s — "10,000+ experiences." / "Fewer than 50 had an ad." — two lines reveal sequentially on a clean white field
2. **The Input** — 5s — Generate form: "7148" types into Experience ID field; 3 dropdowns snap in (Solo Traveller, Curiosity, Storyteller hook); purple Generate button visible
3. **The Pipeline** — 6s — Progress tracker: 5 stage rows complete one by one with checkmarks; cost counter ticks $0.00 → $4.12
4. **The Output** — 5s — Output page: video player card slides in; format badges 9:16 · 1:1 · 16:9 pop in sequentially; cost card shows $4.12 / 2m 47s
5. **Logo** — 2s — Clean white, purple MintAds wordmark centred, tagline below, chime

## Audio
- Audio role: warm professional bed — present but never competing with the UI story
- Audio arc: builds gently through the pipeline, peaks at output reveal, fades under logo
- Music: `assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`
- Music treatment: fade in at 0.3s, volume 0.5, fade out over last 2s (Scene 5)
- Music cue guidance: bundled preset (~110 BPM, ~0.55s beat intervals). Strong cue at 20.19s → target for the format badge reveal in Scene 4. Beat grid for sequential events in Scenes 2 and 3.
- Audio-reactive treatment: subtle — gentle glow/presence breathing on the purple CTA button (Scene 2) and on the checkmark icons as they complete (Scene 3). No waveform visuals.
- Audio-coupled moments:
  - Scene 1 (headline reveals) — each line arrives on a beat
  - Scene 2 (typing) — key tick per character, ~0.08s apart
  - Scene 2 (dropdown selections) — soft select/card sound per dropdown, beat-aligned
  - Scene 2 (button) — clean click/confirm sound
  - Scene 3 (stage completions) — soft tick per row, beat-aligned, ~0.55s apart
  - Scene 4 (format badges) — three soft pops, beat-locked near 20.19s strong cue
  - Scene 5 (logo) — single announcement chime
- SFX selection guidance: favour low high-frequency-risk sounds for the repeated stage ticks. The UI sounds should feel like a real polished app, not a game. Soft and professional.
- SFX analysis guidance: use `~/.claude/skills/brag/assets/sfx/` — check sfx-analysis.md for low high-frequency-risk options for repeated events.
- Exact SFX choice: Hyperframes selects filenames, timestamps, and volume after seeing the implemented animation.
- Audio files: music is already in `assets/music/`. Hyperframes copies any SFX it selects into `assets/sfx/`.

## Hyperframes Instructions
- Show real UI recreations from the MintAds app (not abstract graphics).
- Scene 2: the Generate form must look like the actual app — white background, purple CTA, labelled fields.
- Scene 3: the Progress tracker rows must use the real stage labels and show status transitions (clock → spinner → purple checkmark).
- Scene 4: video player card should be dark (the app uses dark cards for video output), format badges as pill chips.
- All text must be readable — no line disappears before it can be read (0.8s settled minimum for short labels, 0.3s/word for sentences).
- Total duration: exactly 22 seconds across 5 scenes.
- Beat-lock the format badge reveal (Scene 4) to the 20.19s strong cue.
- Beat-grid the stage row completions (Scene 3) to consecutive ~0.55s beat intervals.
- Run lint and validate before render.
