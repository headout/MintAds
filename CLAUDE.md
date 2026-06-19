# MintAds

Experience ID → UGC-style video ads. TypeScript monorepo: Express backend, React+Vite frontend, Remotion assembly. Full specs in `docs/`.

## Structure

```
backend/src/
  routes/           # generate, status, output, config, runs
  services/         # headout-client, claude-client, fal-client, elevenlabs-client, remotion-client
  orchestrator.ts   # pipeline runner
  script-engine.ts  # Claude call + validator + retry
  cost-tracker.ts
  db.ts             # raw pg, no ORM
frontend/src/pages/ # Generate, Progress, Output, History
remotion/src/       # AdComposition.tsx, EndCard.tsx, index.ts
scripts/            # schema.sql, seed.sql
data/runs/          # gitignored — artifacts per run
```

## Git Workflow

Each chunk gets its own branch. Branch naming: `chunk-{N}-{short-description}`.

Rules:
- Always create the branch before starting dev work on a chunk
- All work for a chunk stays on its branch
- Merge to `main` only after review + all checks pass
- Never commit chunk work directly to `main`

Current branches: `feat/02-script-engine`
Branch naming: `feat/{NN}-{short-description}` (e.g. `feat/02-script-engine`)

## Dev Setup

```bash
docker-compose up -d          # Postgres on localhost:5432 (auto-runs schema + seed)
cp .env.example .env          # fill ANTHROPIC_API_KEY, FAL_KEY, ELEVENLABS_API_KEY, CREATOR_PHOTO_URL
cd backend && npm run dev     # port 3000
cd frontend && npm run dev    # port 5173
```

DB: `postgresql://mintads:mintads_dev@localhost:5432/mintads`

## Pipeline

```
POST /api/generate
  → Content Ingestion  (Headout API → facts.json)
  → Script Engine      (Claude claude-sonnet-4-6 → script.json, validator, 1 retry)
  → Video Engine ─┐   (fal.ai Seedance 2.0 I2V, N scenes parallel — 4 or 5 per script)
  → Audio Engine ─┘   (ElevenLabs TTS, parallel with video)
  → Assembly           (Remotion renderMedia per aspect ratio)
  → Export             (save artifacts, finalize DB)
```

## API Gotchas

**Headout** (`api/v6/tour-groups/{id}/` + `api/v2/review/tour-group/id/{id}?limit=10`):
- `highlights`/`inclusions` are HTML — parse `<li>` tags
- Durations are milliseconds — divide by 3,600,000
- Use `reviewCount` not `ratingCount` (always null); use `finalPrice` not `finalListingPrice`
- Reviews: key is `items`; filter `sourceLanguage == "EN"`

**fal.ai Seedance 2.0** (`@fal-ai/client`):
- Auth env: `FAL_KEY` (single key, not KEY_ID:KEY_SECRET)
- Two endpoints selected per `shot_type`:
  - `ugc_creator` → `bytedance/seedance-2.0/fast/reference-to-video` (requires `end_user_id`, early access)
  - `b_roll | pov | experience_detail` → `bytedance/seedance-2.0/fast/image-to-video`
- `generate_audio: false` always — ElevenLabs owns audio
- `duration` is a **string** ("4"–"15"), not a number
- `image_urls[]` for reference-to-video (up to 9); `image_url` (singular string) for image-to-video
- Every `@ImageN` in `image_urls` MUST be referenced in the prompt — unused refs confuse the model
- Creator photo (`CREATOR_PHOTO_URL` env) is always `@Image1` for ugc_creator scenes; omit if env is blank
- Cost: $0.2419/sec regardless of endpoint
- Generate master `9:16` only; Remotion crops 1:1 and 16:9

**Remotion**: bundle once at startup, reuse. End card is a React component, NOT a Seedance clip.

## Key Decisions

- No ORM — raw `pg` parameterized queries
- No auth — internal demo
- No WebSockets — frontend polls `GET /api/status/:ad_id` every 2s
- `ffprobe` required in PATH for audio duration check
- Seedance partial failure: if ≥1 scene succeeds, assembly continues; 0 = fail
- Remotion failure → ffmpeg CLI fallback

## Ad ID Convention

`HDO_META_{POI}_{Angle}_{Hook}_UGC_{Lang}_{Version}`
e.g. `HDO_META_Colosseum_A3_problem_UGC_EN_v01`

## Test IDs

`7148` = Colosseum Rome (tracer bullet) · `23604` = Eiffel Tower Paris
