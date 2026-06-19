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

### Higgsfield (default params)

```
Model: "seedance-v2.0-i2v"
Quality: "high" for hook scene, "basic" for body/payoff
Aspect ratio: "9:16" (master — Remotion crops for others)
generate_audio: false
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

#### script.json — `video_script.global_style` addition (Chunk 2.1)

Claude must also generate a `global_style` block alongside `scenes[]`. This block is consumed by Chunk 3 and Chunk 5 to ensure all segments feel like one coherent ad.

```json
"global_style": {
  "creator_description": "25-year-old solo female traveller, white linen shirt, slim-fit jeans, light daypack, warm Mediterranean tan. Same person, same outfit in every scene.",
  "aesthetic": "UGC handheld 9:16, warm natural Mediterranean light, slightly shaky camera, cinematic but authentic",
  "background_music_volume": [0.2, 0.2, 0.35]
}
```

- `creator_description`: specific enough for Higgsfield to reproduce the same person across 3 independent calls. Claude derives this from persona + experience location + angle tone.
- `aesthetic`: shared visual style prefix prepended to every Higgsfield prompt.
- `background_music_volume`: per-scene float (0–1). Higgsfield bakes ambient/music audio into clips; Remotion uses these values when mixing VO on top. Lower during heavy VO scenes (hook/body), higher for payoff.

**System prompt addition for Chunk 2.1**: Add `global_style` to the output schema. Instruct Claude to define a consistent creator persona fitting the selected `persona` + experience location, and a visual aesthetic matching the angle/hook energy.

**Types addition**: Add `GlobalStyle` interface to `types.ts`; extend `VideoScript` to include `global_style: GlobalStyle`.

---

### Chunk 3: Video Engine
**Scope**: `higgsfield-client.ts` module. Takes a scene object + global_style + facts metadata. Assembles the full Higgsfield prompt (global prefix + scene direction). Calls Higgsfield SDK `subscribe()` with Seedance 2.0 I2V. Waits for completion via built-in polling. Downloads resulting MP4 to local filesystem. Returns file path + actual duration. Includes retry logic (1 retry per scene). Sanity check (file exists, non-zero bytes).

The orchestrator calls this 3 times in parallel (one per scene) via `Promise.all`.

**Input**: `{ scene, global_style, experience_photo_url, soul_id?, duration, aspect_ratio }` per scene
**Output**: `{ file_path, duration_sec }` per clip
**Dependencies**: Chunk 2 (needs script.json for visual_direction + global_style + photo_reference_index), Chunk 1 (needs facts.json for photo URLs)

#### Creator consistency — SoulId (Chunk 3 key decision)

The Higgsfield SDK exposes `createSoulId({ name, input_images })` → `/v1/custom-references`. A SoulId is a pre-registered creator character that can be referenced in every Seedance call, producing the same person across all segments.

**Setup (one-time, pre-configured)**:
- Store 2–3 reference images of the chosen creator in `static/creators/{creator_id}/`
- On server startup (or first run), call `higgsfield.createSoulId()` with those images → get `soul_id`
- Cache the `soul_id` (store in DB `config` table under key `higgsfield_soul_id`)
- Pass `soul_id` in every Seedance generation call

This eliminates the creator inconsistency problem at the model level without prompt engineering hacks.

#### Full Higgsfield prompt assembly

Each scene call constructs its prompt as:

```
{global_style.aesthetic}.
Creator: {global_style.creator_description}.
Location: {facts.city} — {facts.title}.
Photo context: {photo.keyword}.
Do NOT embed any text, captions, subtitles, titles, or watermarks in the frame.
No speech or lip-sync audio. Background music only.
Creator shows only natural authentic human reactions — genuine awe, wonder, excitement.
No winking, no exaggerated gestures, no theatrical expressions. Real person, real moment.
All scenes share the same visual theme and color grade to cut together seamlessly.
---
{scene.visual_direction}
```

#### `images_list` — image count and cost

- **Limit**: The SDK types do not explicitly cap `images_list`. For Seedance I2V, 1–2 images is the practical range. Sending 2 images (e.g. two complementary venue shots) can help the model blend context, but 1 strong image is usually better than 2 mediocre ones. **Confirm actual limit via Higgsfield docs before Chunk 3 build.**
- **Cost**: Higgsfield pricing is based on output video duration × quality tier only. Additional input images do not affect cost.
- **Recommended default**: 1 experience photo per scene (matched via `photo_reference_index`). If a scene has `photo_reference_index: null` (CTA beat), skip the Higgsfield call entirely — that scene is Remotion-rendered.

#### Hard constraints baked into every call

| Constraint | How enforced |
|---|---|
| No embedded text/captions | Hard string in global prefix |
| No speech audio | `generate_audio: false` param + prompt instruction |
| Appropriate behaviour only | Hard string in global prefix |
| Consistent creator | `soul_id` param + `creator_description` in prefix |
| Consistent aesthetic | `global_style.aesthetic` prefix on every call |
| Same seed for style consistency | Pass same `seed` value to all 3 scene calls |

---

### Chunk 4: Audio Engine
**Scope**: `elevenlabs-client.ts` module. Takes full VO text (concatenated from vo_segments). Calls ElevenLabs `textToSpeech.convert()`. Writes audio stream to MP3 file. Gets actual duration via ffprobe. Sanity check (file exists, non-zero bytes, duration within ±5s of target). Returns file path + duration.

Runs in parallel with Chunk 3 (video) — both triggered after script validation passes.

**Input**: `script.audio_script.vo_segments[].vo_text` concatenated
**Output**: `{ file_path, duration_sec }`
**Dependencies**: Chunk 2 (needs script.json for VO text)

---

### Chunk 5: Assembly (Remotion)
**Scope**: Remotion project setup. `AdComposition.tsx` React component (sequences video clips + layers VO audio + adds text overlays + appends branded end card). `EndCard.tsx` component (price, rating, CTA, logo). `remotion-client.ts` module that bundles once at startup and calls `renderMedia()` per aspect ratio. Handles 9:16 master + 1:1 + 16:9 via width/height overrides. Downloads remote video clip URLs to local if needed. Outputs final MP4 files.

**Input**: video clips[] + vo_audio file + script.json (overlays, end card data) + format selection
**Output**: Final MP4 files (1–3 depending on format selection)
**Dependencies**: Chunks 3 + 4 (needs video clips + VO audio)

---

### Chunk 6: Orchestrator + Cost Tracking
**Scope**: `orchestrator.ts` — the `runPipeline()` function that wires Chunks 1–5 in sequence (ingestion → script → parallel(video, audio) → assembly → export). Status updates to DB at each stage transition. Cost tracking: wrapper functions that log every external API call to `stage_logs` table with cost_usd. Ad ID generation from naming convention. Error handling: catch at each stage, update run status to 'failed' with error message. Export: save all artifacts to filesystem, insert asset records, compute total cost.

**Input**: `UserInput` from API request
**Output**: Completed run with all files in `/data/runs/{ad_id}/`
**Dependencies**: All chunks 1–5

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
