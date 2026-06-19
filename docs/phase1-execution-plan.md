# MintAds Phase 1 — Chunk-Wise Execution Plan

**Goal**: Working end-to-end pipeline. Experience ID in → finished video ads out. No polish, no edge cases, just the chain working.

---

## Default Values (use until Gokul's manual testing replaces them)

### Angles (hardcoded for now)

```json
[
  { "id": "A1", "name": "The Iconic Moment", "description": "Sell the dream-state of being there. Pure wanderlust. Brand in background.", "example": "This is what 7am at the Taj Mahal feels like." },
  { "id": "A2", "name": "Bucket-List FOMO", "description": "Frame as un-missable. Pain of regret. Loss aversion.", "example": "You flew 8 hours to Rome and DIDN'T go inside the Colosseum?" },
  { "id": "A3", "name": "Skip-the-Line", "description": "Queues = wasted holiday. Dramatize 3-hour line, rescue with skip-the-line.", "example": "They waited 3 hours. We walked straight in." },
  { "id": "A4", "name": "Is It Worth It?", "description": "Meet price objection head-on. Show what you get. Free cancellation close.", "example": "$68 for the Vatican — worth it? Watch this." },
  { "id": "A5", "name": "Social Proof", "description": "Rating + review count + real traveller reactions. Crowd confidence.", "example": "4.8★ from 2M+ travellers. Here's why." }
]
```

### Hooks (hardcoded for now)

```json
[
  { "id": "problem", "name": "Problem", "template": "Going to {city} and dreading the {POI} queue?" },
  { "id": "outcome", "name": "Outcome", "template": "This is how you skip every line at {POI}." },
  { "id": "fomo", "name": "FOMO", "template": "You're in {city} and NOT doing {POI}??" },
  { "id": "curiosity", "name": "Curiosity", "template": "{price} for {POI} — worth it?" },
  { "id": "social_proof", "name": "Social Proof", "template": "{rating}★ from {review_count}+ travellers." },
  { "id": "mistake", "name": "Mistake", "template": "The #1 mistake tourists make at {POI}." },
  { "id": "transformation", "name": "Transformation", "template": "I almost skipped {POI}. Biggest regret-saver of the trip." }
]
```

### Personas (hardcoded for now)

```json
[
  { "id": "solo", "name": "Solo Traveller" },
  { "id": "couple", "name": "Couple" },
  { "id": "art_enthusiast", "name": "Art Enthusiast" },
  { "id": "cultural", "name": "Cultural Traveller" },
  { "id": "family", "name": "Family" },
  { "id": "budget", "name": "Budget Traveller" }
]
```

### Test Experience IDs

| ID | Experience | City |
|---|---|---|
| `7148` | Colosseum, Palatine Hill & Roman Forum Pass | Rome |
| `23604` | Eiffel Tower Guided Tour by Elevator | Paris |

Use `7148` as the tracer bullet experience. Add 3 more once Gokul confirms.

### ElevenLabs Voice (default until Gokul picks)

```
Voice ID: "JBFqnCBsd6RMkjVDRZzb" (George — warm, conversational)
Model: "eleven_multilingual_v2"
Stability: 0.35
Similarity boost: 0.75
```

### fal.ai Seedance (default params)

```
Endpoint:
  lip_sync: true  → bytedance/seedance-2.0/fast/reference-to-video
  ugc_creator (no lip_sync) → bytedance/seedance-2.0/fast/reference-to-video
  b_roll | pov | experience_detail → bytedance/seedance-2.0/fast/image-to-video

Aspect ratio: "9:16" (master — Remotion crops for 1:1, 16:9)
generate_audio: true for lip_sync scenes (needed for mouth movement); false for all others
Duration: 4–10s per scene (string, set by script.json per scene)
image_urls: venue photos from facts.photos[photo_reference_indices] (1–2 per scene)
audio_urls: [voSegment.filePath] for lip_sync scenes only
```

### Creator consistency (no SoulId)

```
Creator photo stored at static/creators/ — URL set via CREATOR_PHOTO_URL env var.
For ugc_creator scenes (lip_sync: true or false): creator photo prepended as first entry in image_urls, referenced as @Image1 in prompt.
For b_roll | pov | experience_detail: creator photo omitted entirely.
No SoulId or API registration required — consistency is maintained via the same reference photo + creator_description in the global prompt prefix.
```

---

## Third-Party API Contracts

### 1. Headout Catalog API (no auth)

**Experience details:**
```
GET https://www.headout.com/api/v6/tour-groups/{tourGroupId}/

Response (key fields):
{
  "name": "string",
  "shortSummary": "string (HTML, can be empty)",
  "summary": "string (HTML)",
  "city": { "displayName": "Rome", "country": { "displayName": "Italy" } },
  "primaryCategory": { "displayName": "Tickets" },
  "listingPrice": {
    "finalPrice": 28.9,
    "originalPrice": 29.9,
    "currencyCode": "EUR",
    "bestDiscount": 3
  },
  "minDuration": 3600000,    // milliseconds, can be null
  "maxDuration": 7200000,    // milliseconds, can be null
  "averageRating": 4.4,
  "reviewCount": 26773,
  "descriptors": [{ "code": "...", "displayName": "...", "description": "..." }],
  "highlights": "<ul><li>...</li></ul>",     // HTML string, NOT array
  "inclusions": "<ul><li>...</li></ul>",     // HTML string, NOT array
  "imageUploads": [
    { "url": "https://cdn-imgix.headout.com/...", "alt": "...", "keyword": "...", "title": "...", "credit": "..." }
  ],
  "topReviews": [
    { "rating": 5.0, "content": "...", "nonCustomerName": "...", "sourceLanguage": "EN", "useTranslatedContent": false, "translatedContent": null }
  ],
  "hasFreeCancellation": true,
  "hasSkipTheLine": true,
  "url": "/tour/7148/italy/rome/..."
}

GOTCHAS:
- highlights/inclusions are HTML → parse <li> tags
- summary is HTML → strip tags
- duration is milliseconds → divide by 3600000; null for most experiences — handle gracefully, don't fail
- shortSummary can be empty string
- use finalPrice not finalListingPrice
- use currencyCode not currency
- use reviewCount not ratingCount (ratingCount is always null)
- use imageUploads[] not media.productImages[] — imageUploads has the keyword field needed by Claude
- topReviews (5 items) is already embedded in the main response — no second API call needed
- review text field is content not text; reviewer is nonCustomerName; score is rating (float)
- filter topReviews to sourceLanguage == "EN"; if useTranslatedContent == true use translatedContent
```

### 2. Claude API (script generation)

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: $ANTHROPIC_API_KEY
  content-type: application/json
  anthropic-version: 2023-06-01

Body:
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 2000,
  "system": "<system prompt from ERD section 3.2>",
  "messages": [{ "role": "user", "content": "<user message with facts + inputs>" }]
}

Response:
{
  "content": [{ "type": "text", "text": "<script.json as string>" }],
  "usage": { "input_tokens": 1600, "output_tokens": 1000 }
}

Cost: $0.003/1K input tokens, $0.015/1K output tokens
Typical: ~$0.02 per call
```

### 3. Higgsfield SDK (video generation)

```typescript
// npm install @higgsfield/client
import { higgsfield, config } from '@higgsfield/client/v2';
config({ credentials: 'KEY_ID:KEY_SECRET' }); // from env

const jobSet = await higgsfield.subscribe('seedance-v2.0-i2v', {
  input: {
    prompt: "string — scene visual direction",
    images_list: ["string — product photo URL"],
    aspect_ratio: "9:16",
    duration: 5,                // 4-15 seconds
    quality: "high" | "basic",
    generate_audio: false,
  },
  withPolling: true,   // SDK auto-polls until done
});

// Result
jobSet.isCompleted  // boolean
jobSet.jobs[0].results?.raw.url  // video MP4 URL (remote CDN)

// Status checks
jobSet.isQueued / jobSet.isInProgress / jobSet.isFailed / jobSet.isNsfw

// SDK config
timeout: 120000        // 2 min default
pollInterval: 2000     // check every 2s
maxPollTime: 300000    // 5 min max wait

Cost: ~$0.15/sec (fast) to $0.30/sec (standard) at 720p
Typical: 5s clip = $0.75–1.50
Latency: 60–120 seconds per clip
```

### 4. ElevenLabs SDK (audio generation)

```typescript
// npm install @elevenlabs/elevenlabs-js
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

const audio = await client.textToSpeech.convert("VOICE_ID", {
  text: "Full VO script text here...",
  model_id: "eleven_multilingual_v2",
  voice_settings: {
    stability: 0.35,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true,
  },
});

// audio is ReadableStream<Uint8Array> → write to file
for await (const chunk of audio) {
  writeStream.write(chunk);
}

// For word-level timestamps (stretch goal):
const result = await client.textToSpeech.convertWithTimestamps("VOICE_ID", { ... });
// result.alignment.words = [{ word, start_time, end_time }]

Cost: $0.03 / 1K characters
Typical: 350 chars = ~$0.01
Latency: 3–8 seconds
```

### 5. Remotion Renderer (assembly)

```typescript
// npm install remotion @remotion/renderer @remotion/bundler
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

// Bundle ONCE at server start
const bundleLocation = await bundle(resolve('./src/remotion/index.ts'));

// Per-render
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'AdComposition',
  inputProps: { clips, voAudioSrc, textOverlays, endCard, fps: 30 },
});

await renderMedia({
  composition: { ...composition, width: 1080, height: 1920, durationInFrames: 600, fps: 30 },
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: '/data/runs/{ad_id}/output/9x16.mp4',
  inputProps: { clips, voAudioSrc, textOverlays, endCard, fps: 30 },
});

Aspect ratios: { '9:16': 1080×1920, '1:1': 1080×1080, '16:9': 1920×1080 }
Cost: $0.00 (self-hosted)
Latency: 15–30 seconds per aspect ratio
Requires: Node 16+, headless Chrome (Remotion installs this)
```

---

## Phase 1 Chunks (high-level scope only)

### Chunk 0: Project Setup
**Scope**: Replit project scaffold. Monorepo with `/backend`, `/frontend`, `/remotion` dirs. TypeScript config. Express server with health check. React app with Vite. PostgreSQL connection. Schema migration (7 tables). Seed data (angles, hooks, personas). Environment variables template. Static file serving from `/data`.

---

### Chunk 1: Content Ingestion
**Scope**: `headout-client.ts` module. Takes a `tourGroupId`, calls both Headout endpoints, parses HTML fields (highlights, inclusions, summary), converts duration from ms, filters English reviews, assembles `facts.json` object, validates required fields are present (title, price, at least 1 photo), saves to DB + filesystem. Error handling for 404 / timeout / missing fields.

**Input**: `experience_id: string`
**Output**: `FactsJson` object
**Dependencies**: None (first stage)

---

### Chunk 2: Script Engine
**Scope**: `script-engine.ts` module. Takes `facts.json` + user inputs + angle description + hook description. Constructs system prompt + user message. Calls Claude API. Parses JSON response. Runs the 3-check validator (structural, claim completeness, orphan detection). On failure, retries once with violations appended. On success, builds claim report. Saves script.json + claim_report to DB.

**Input**: `FactsJson` + `UserInput` + angle/hook descriptions
**Output**: `ScriptJson` (validated) + `ClaimReport`
**Dependencies**: Chunk 1 (needs facts.json)

**`lip_sync` flag**: Every non-cta scene must include `lip_sync: boolean`. Claude sets it `true` only when `shot_type === "ugc_creator"` AND the creator is speaking directly to camera. Reaction/walking ugc_creator scenes get `lip_sync: false`. Validator enforces: `lip_sync` must be present on all scenes; `lip_sync: true` is only valid on `ugc_creator` shot type.

#### Key script.json design decisions (updated)

**Dynamic scene count**: Claude decides 4 or 5 content scenes (+ 1 end card) based on what the experience needs. No fixed 3-scene structure. Total ad: 30–40s.

**Scene duration envelope**: Each content scene is 4–10s. Total content scenes: 26–36s. CTA end card: 4s fixed.

**Shot types**: Every scene has a `shot_type` — `ugc_creator | b_roll | pov | experience_detail`. This drives Higgsfield prompt construction and image selection in Chunk 3.

**Multiple photo references**: `photo_reference_indices: number[]` (array, was single index). Claude picks 1–2 venue photo indices per scene based on shot_type and photo keyword/alt match.

**`global_style` block** (consumed by Chunk 3 + Chunk 5):
```json
"global_style": {
  "creator_description": "25-year-old solo female traveller, white linen shirt, slim-fit jeans, light daypack, warm Mediterranean tan. Same person, same outfit in every scene.",
  "aesthetic": "UGC handheld 9:16, warm natural Mediterranean light, slightly shaky camera, cinematic but authentic",
  "background_music_volume": [0.2, 0.15, 0.2, 0.4]
}
```
- `creator_description`: specific enough for SoulId + Higgsfield to reproduce the same person across all calls
- `aesthetic`: prepended verbatim to every Higgsfield prompt
- `background_music_volume`: **dynamic length** — one float per non-cta scene (4 or 5 values depending on scene count)

**Validator rules**:
- Exactly 1 hook, 1 payoff, 1 cta; 2–3 body scenes
- Total video duration (all scenes incl cta): 30–40s
- Non-cta content total: 26–36s
- VO total: 26–36s
- `photo_reference_indices` in range, `[]` for cta
- `background_music_volume` length = non-cta scene count

---

### Chunk 3: Video Engine
**Scope**: `fal-client.ts` module. Takes a scene object + global_style + facts metadata + optional VO segment file path. Assembles the full fal.ai prompt (global prefix + scene direction + lip-sync instruction if applicable). Calls fal.ai SDK `fal.subscribe()` with Seedance 2.0. Waits for completion via built-in polling. Downloads resulting MP4 to local filesystem. Returns file path + actual duration. Includes retry logic (1 retry per scene). Sanity check (file exists, non-zero bytes).

The orchestrator calls this in two waves (see Chunk 6): non-lip-sync scenes fire in parallel with audio generation; lip-sync scenes fire only after all VO segments are ready.

**Input**: `{ scene, global_style, facts, voSegmentPath?: string }` per scene — `voSegmentPath` is the local ElevenLabs MP3 path, passed only for `lip_sync: true` scenes
**Output**: `{ file_path, duration_sec, scene_id, beat, shot_type }` per clip
**Dependencies**: Chunk 2 (needs script.json). Lip-sync scenes additionally depend on Chunk 4 (need VO segment before calling fal.ai).

**Routing logic by `lip_sync` + `shot_type`**:
- `lip_sync: true` → `reference-to-video`, `audio_urls: [voSegmentPath]`, `generate_audio: true`
- `ugc_creator` + `lip_sync: false` → `reference-to-video`, no audio_urls, `generate_audio: false`
- `b_roll | pov | experience_detail` → `image-to-video`, `generate_audio: false`

**Prompt construction**: `@Audio1` reference line added only when `lip_sync: true`. Creator instruction changes: "lip movements MUST match @Audio1" vs "natural reactions only — no speaking".

#### Creator consistency — SoulId

The Higgsfield SDK exposes `createSoulId({ name, input_images })` → `/v1/custom-references`. A SoulId pre-registers a creator character that reproduces the same person across all Seedance calls.

**Setup (one-time, pre-configured)**:
- Store 2–3 reference creator images in `static/creators/{creator_id}/`
- On server startup: call `higgsfield.createSoulId()` with those images → get `soul_id`
- Cache `soul_id` in DB `config` table under key `higgsfield_soul_id`
- Pass `soul_id` ONLY on scenes where `shot_type === "ugc_creator"` — skip for b_roll/pov/experience_detail

#### `images_list` construction — by shot_type

| shot_type | images_list | Notes |
|---|---|---|
| `ugc_creator` | venue photos from `photo_reference_indices` (1–2) | Creator identity comes from SoulId, not images_list |
| `b_roll` | venue photos from `photo_reference_indices` (1–2) | Two complementary angles produce richer generation |
| `pov` | 1 venue photo from `photo_reference_indices` | Single strong reference; camera IS the creator's eyes |
| `experience_detail` | 1 venue photo from `photo_reference_indices` | Most detail-rich photo |

Cost: Higgsfield charges by output duration × quality tier only. Extra input images do not increase cost.

#### Full Higgsfield prompt assembly

Each scene call constructs its prompt as:

```
{global_style.aesthetic}.
Creator: {global_style.creator_description}.
Location: {facts.city} — {facts.title}.
Photo context: {photo.keyword for each photo in images_list}.
Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.
No speech or lip-sync audio. Background music only.
Creator shows only natural authentic human reactions — genuine awe, wonder, excitement.
No winking, no exaggerated gestures, no theatrical expressions. Real person, real moment.
All scenes share the same visual theme and color grade to cut together seamlessly.
---
{scene.visual_direction}
```

#### Hard constraints baked into every call

| Constraint | How enforced |
|---|---|
| No embedded text/captions | Hard string in global prefix |
| No speech audio | `generate_audio: false` param + prompt instruction |
| Consistent creator | `soul_id` param on ugc_creator scenes + `creator_description` in prefix |
| Consistent aesthetic | `global_style.aesthetic` prefix on every call |
| Quality tier | hook → `"high"`, all others → `"basic"` |
| Master aspect ratio | `"9:16"` always — Remotion handles 1:1, 16:9 |

---

### Chunk 4: Audio Engine
**Scope**: `elevenlabs-client.ts` module. Generates one ElevenLabs TTS call **per `vo_segment`** (N parallel calls). Each segment's text gets SSML `<break>` tags appended using `pause_after_sec` from script.json. Writes each audio stream to its own MP3 file (`vo_001.mp3`, `vo_002.mp3`, …). Gets actual duration of each file via ffprobe. Sanity checks per file (exists, non-zero bytes, duration within ±3s of target). Returns array of `{ scene_id, file_path, duration_sec }`.

Runs as **Step 1** of the video+audio pipeline — in parallel with non-lip-sync video generation. Lip-sync video generation (Chunk 3) must wait for all segments to complete.

**Input**: `script.audio_script.vo_segments[]` — one entry per non-cta scene
**Output**: `VoSegmentResult[]` — `{ scene_id, file_path, duration_sec }` per segment
**Dependencies**: Chunk 2 (needs script.json for VO text + pause_after_sec)

**SSML breaks**: ElevenLabs `eleven_multilingual_v2` supports `<break time="Xms"/>`. Insert at end of each segment text using `segment.pause_after_sec` (converted to ms) to create natural beat-boundary pauses without silence gaps in the final audio layering.

---

### Chunk 5: Assembly (Remotion)
**Scope**: Remotion project setup. `AdComposition.tsx` React component sequences video clips (ALL muted via `volume={0}`) + layers each ElevenLabs VO segment as a separate `<Audio>` component at its correct scene timestamp + adds text overlays + appends branded end card. `EndCard.tsx` component (price, rating, CTA, logo). `remotion-client.ts` module that bundles once at startup and calls `renderMedia()` per aspect ratio. Handles 9:16 master + 1:1 + 16:9 via width/height overrides. Outputs final MP4 files.

**Input**: `clips[]` + `voSegments[]` (one per scene, with `scene_id` + `filePath` + `durationSec`) + `script.json` (overlays, end card data) + format selection
**Output**: Final MP4 files (1–3 depending on format selection)
**Dependencies**: Chunks 3 + 4 (needs video clips + all VO segment files)

**Audio layering**: `voSegments` are ordered by `scene_id`. Each is wrapped in `<Sequence from={cumulativeSceneStartFrame}>` so the audio lines up precisely with its corresponding video clip. All clip audio is muted — consistent voice quality across all scenes regardless of whether a clip is lip-synced or b-roll.

---

### Chunk 6: Orchestrator + Cost Tracking
**Scope**: `orchestrator.ts` — the `runPipeline()` function that wires Chunks 1–5. Status updates to DB at each stage transition. Cost tracking: wrapper functions that log every external API call to `stage_logs` table with cost_usd. Ad ID generation from naming convention. Error handling: catch at each stage, update run status to 'failed' with error message. Export: save all artifacts to filesystem, insert asset records, compute total cost.

**Input**: `UserInput` from API request
**Output**: Completed run with all files in `/data/runs/{ad_id}/`
**Dependencies**: All chunks 1–5

**Pipeline sequencing** (replaces the old simple `Promise.all([video, audio])`):
```
ingestion → script → Step 1: Promise.all([generateAllVoSegments, generateVideoClips(nonLipSync)])
                  → Step 2: generateVideoClips(lipSyncScenes, voSegments)   ← sequential after Step 1
                  → Assembly (all clips + all voSegments)
                  → Export
```
Step 1 fires non-lip-sync video generation and audio generation in parallel — both start immediately after script validation. Step 2 fires lip-sync video generation only after `voSegments` resolves, passing the matching `voSegmentPath` per scene. This adds ~5s of latency vs the old parallel approach but is necessary for lip-sync. Effective wall time is unchanged because video generation (~90s) is always the bottleneck.

---

### Chunk 7: API Layer
**Scope**: Express routes. `POST /api/generate` (validates input, creates run, kicks off orchestrator async, returns ad_id). `GET /api/status/:ad_id` (reads run + stage_logs, returns progress). `GET /api/output/:ad_id` (reads run + assets, returns videos/cost/claims). `GET /api/config/angles`, `/hooks`, `/personas` (reads from DB). `GET /api/runs` (lists all runs). Static file serving for `/data/runs/` directory.

**Input**: HTTP requests from frontend
**Output**: JSON responses
**Dependencies**: Chunk 6 (orchestrator) + DB schema (Chunk 0)

---

### Chunk 8: Frontend
**Scope**: React app with 4 pages. **Generate page**: form with dropdowns (populated from /api/config/*) + Generate button. **Progress page**: polls /api/status every 2s, shows stage-by-stage tracker with costs. **Output page**: video player with format tabs (9:16, 1:1, 16:9), cost breakdown card, claim report card, download links. **History page**: table of all runs with status/cost/timestamp.

**Input**: User interactions
**Output**: API calls to backend, rendered UI
**Dependencies**: Chunk 7 (API layer)

---

## Chunk Dependency Graph

```
Chunk 0 (Setup)
    │
    ├── Chunk 1 (Ingestion)
    │       │
    │       └── Chunk 2 (Script Engine)
    │               │
    │               ├── Chunk 3 (Video Engine)  ─┐
    │               │                             ├── Chunk 5 (Assembly)
    │               └── Chunk 4 (Audio Engine)  ─┘
    │                                               │
    └── Chunk 6 (Orchestrator) ←───────────────────┘
            │
            └── Chunk 7 (API Layer)
                    │
                    └── Chunk 8 (Frontend)
```

## Who Builds What

| Chunk | Owner | When |
|---|---|---|
| 0 - Setup | Rushi | Thu 6–9 PM |
| 1 - Ingestion | Rushi | Thu 9 PM–12 AM |
| 2 - Script Engine | Rushi | Thu 9 PM – Fri morning |
| 3 - Video Engine | Rohan | Thu 9 PM – Fri morning |
| 4 - Audio Engine | Rohan | Thu 9 PM – Fri morning |
| 5 - Assembly | Rohan | Fri morning |
| 6 - Orchestrator | Rushi | Fri morning (integration) |
| 7 - API Layer | Rushi | Fri afternoon |
| 8 - Frontend | Rushi | Fri afternoon–evening |

**Integration point**: Friday morning. Rushi has chunks 1+2 producing `facts.json` + `script.json`. Rohan has chunks 3+4+5 consuming those files and producing video. Wire them together in the orchestrator → tracer bullet complete.

---

## Tracer Bullet Definition (Friday ~12 PM)

**One command / one API call produces one finished video:**

```bash
# Either via API:
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "experience_id": "7148",
    "persona": "solo",
    "journey_type": "pre_trip",
    "brand": "headout",
    "angle": "A3",
    "hook": "problem",
    "video_format": "9:16"
  }'

# Or via a test script:
npx ts-node scripts/test-pipeline.ts 7148
```

**Expected output**: `/data/runs/HDO_META_Colosseum_A3_problem_UGC_EN_v01/output/9x16.mp4` — a playable 20-second UGC-style video ad with VO, text overlays, and branded end card.

If this works, Phase 1 is de-risked. Everything after is scale + polish.
