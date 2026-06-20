# Implementation Plan: MintAds Chunk 8 — Frontend

## Overview

Build the React + Vite frontend (the last Phase-1 chunk). Four pages — **Generate → Progress → Output**, plus **History** — wired to the already-built REST API (Chunk 7) and styled with the **Headout Design System** (`/Users/apple/Headout Design System`). The backend, DB, and pipeline are complete and merged; this chunk is pure UI consuming documented contracts. No backend changes.

Pipeline the user drives: enter an Experience ID + creative inputs → watch the pipeline run live → play/download finished UGC video ads in 1–3 aspect ratios.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Routing | `react-router-dom` v6, 4 routes + index | Standard, clean; `ad_id` lives in the URL (no global store). |
| Server data | Tiny custom layer: typed `api.ts` + `usePolling` hook | Matches project ethos (raw `pg`, no ORM, no WebSockets). Avoids a heavy dep (React Query) for one polling screen. |
| Styling | **Vanilla CSS Modules + Headout DS tokens** (`colors_and_type.css`) imported once globally | The DS is a CSS-variable token system, not Tailwind. CSS Modules consume `--color-purps`, `.t-*` classes directly with zero fighting. No Tailwind, no CSS-in-JS. |
| Component model | Small `components/ui/` primitive kit (Button, Select, Card, Tag, StatusBadge, Icon…) | Composition over configuration (per frontend-ui-engineering skill). Encodes DS recipes once. |
| Client state | Local + lifted + URL only | No app-wide client state needed. |
| API base | Vite proxy (already configured: `/api` + `/data` → `:3000`) | No env var needed for dev. `VITE_API_URL` optional override for prod. |

### Design-system integration (the "build perfectly from the get-go" requirement)

- Copy DS assets into `frontend/src/styles/ds/` **preserving the `fonts/` subfolder** — `colors_and_type.css` uses relative `url('./fonts/HalyardText-*.otf')`; flattening the folder 404s the fonts. (All 12 weights confirmed present.)
- Import `ds/colors_and_type.css` once in `main.tsx`. Every component uses `var(--*)` tokens and `.t-*` text classes — **never raw hex, never off-scale px**.
- **Brand rules baked into the primitive kit** (from DS README + `preview/*.html`):
  - **Purps `#8000ff` is scarce** — primary CTA / active state / brand accent only. Workhorse surfaces are white + grey-50.
  - **Sentence case everywhere** ("Generate ad", not "Generate Ad"). Voice: confident, second-person, breezy.
  - **Radius 12px default** (buttons, cards); 8px compact; 4–6px tags. `--shadow-1` resting card → `--shadow-2` hover. Press = `scale(0.95)` + `--ease-functional-standard`. Hover = background tone shift, not opacity.
  - **Icons = Onix only** from `assets/icons/` (1.5px stroke, `currentColor`). No emoji-as-icon, no Lucide/Heroicons. (Pipeline-stage status ticks may use the bundled checkmark/cross/hourglass SVGs.)
  - **Trust boosters** ("Free cancellation", "Instant confirmation", "Mobile ticket") are first-class — reuse on the end-card/claim surfaces.
- Button recipe (from `preview/buttons.html`): primary = `background:var(--cta-primary)` + `color:#fff`; tertiary = `var(--surface-primary-1)` bg + `var(--text-primary)`; white = `#fff` + `inset 0 0 0 1.5px var(--divider-dark)`; disabled = `var(--cta-disabled-primary)`. Sizes sm `6/12` r8, md `10/16` r12, lg `14/24` r12, `.t-cta-*`.

## Verified API Contracts (source of truth = backend code, not just ERD)

```
GET  /api/config/angles    → [{ id, name, description, example_line, sub_format, journey, brand_lean }]
GET  /api/config/hooks     → [{ id, name, template, description }]
GET  /api/config/personas  → [{ id, name, description }]
GET  /api/config/angle-hook-map    → { [angleId]: { recommended: string[], works: string[] } }
GET  /api/config/persona-angle-map → { [personaId]: { recommended: string[], works: string[] } }

POST /api/generate   body { experience_id, persona, journey_type, brand, angle, hook, video_format, additional_details? }
                     → 202 { ad_id, run_id }   |   400 { error }   |   500 { error }
GET  /api/status/:ad_id → { ad_id, run_id, status, current_stage, total_cost_usd, error_message,
                            created_at, completed_at,
                            stages: [{ stage, status, service, cost_usd, duration_ms, started_at, completed_at }] }
GET  /api/output/:ad_id → 200 { ad_id, experience_id, videos:[{ format, url, duration_sec, file_size }],
                                 cost_breakdown:{ total, by_service, by_stage }, claim_report, script, facts }
                          409 { error, status, error_message } until status === 'completed'
GET  /api/runs?status&experience_id&limit&offset
                     → [{ ad_id, experience_id, angle, hook, persona, video_format, status,
                          total_cost_usd, created_at, completed_at, duration_sec }]
```

**Enum / string values the UI must handle (pulled from orchestrator + services):**

- Run `status`: `pending → ingesting → scripting → generating → assembling → exporting → completed` (terminal) | `failed` (terminal).
- `stage_logs[].stage`: `content_ingestion`, `script_gen`, `script_validation`, `video_gen_scene_{n}` (one per content scene, 4–5), `audio_gen_scene_{n}` (one per non-cta scene), `assembly`, `export`.
- `stage_logs[].status`: `pending | in_progress | completed | failed` → icon map (⏳ / 🔄 / ✅ / ❌, rendered as Onix SVGs).

**Gotchas captured:**
1. `current_stage` during fan-out is the **label** `'video_gen + audio_gen'`, not a `stage_logs` key. The Progress tracker must **group** `video_gen_scene_*` and `audio_gen_scene_*` rows, not read `current_stage`.
2. `script_gen` / `script_validation` can appear **twice** (1 retry). Dedupe by stage name, keep the latest row.
3. `/api/output` returns **409 until completed** — never call it from Progress; History rows that aren't `completed` route to **Progress**, not Output.
4. Video URLs: use the `url` field returned by `/api/output` **verbatim** (`/data/runs/{ad_id}/output/{9x16|1x1|16x9}.mp4`). Don't reconstruct.
5. `total_cost_usd` / `cost_usd` arrive as numbers (already `parseFloat`'d server-side). Format to 2 dp for display.

## Dependency Graph

```
T1 Foundation (deps, DS tokens/fonts, AppShell + router)
   ├── T2 API client + types + usePolling
   └── T3 UI primitive kit (Button, Select, Input, Card, Tag, StatusBadge, Icon, states)
            │
   ┌────────┴───────────────────────────────────┐
   │ (T2 + T3 unblock all four pages — parallelizable)
   ├── T4 Generate page    (entry path)
   ├── T5 Progress page    (live polling)
   ├── T6 Output page      (playback + reports)
   └── T7 History page     (list)
            │
            └── T8 Responsive + a11y + states polish sweep
```

## Task List

### Phase 0: Foundation

#### Task 1 — Project foundation: deps, DS tokens, app shell + routing
**Description:** Add `react-router-dom`. Copy the Headout DS (`colors_and_type.css` + `fonts/` + curated `assets/icons`, `assets/logo`) into `frontend/src/styles/ds/` preserving structure; import tokens once in `main.tsx`. Build `AppShell` (Headout wordmark, sentence-case nav: New ad · History) and the router with routes `/` (Generate), `/progress/:adId`, `/output/:adId`, `/history`.
**Acceptance criteria:**
- [ ] App boots; Halyard fonts load (no 404 in Network tab); `var(--color-purps)` resolves.
- [ ] All four routes render a placeholder; nav highlights active route in purps.
- [ ] No raw hex / off-scale px in any committed CSS (tokens only).
**Verification:** `cd frontend && npm run build` clean; `npm run dev` → visit each route; DevTools → fonts 200, computed `--color-purps` = `#8000ff`.
**Dependencies:** None · **Scope:** M

#### Task 2 — Typed API client, shared types, polling hook
**Description:** `src/lib/api.ts` — typed wrappers for every endpoint above, throwing structured errors on non-2xx (surfacing backend `{ error }`). `src/lib/types.ts` — TS interfaces mirroring the contracts. `src/hooks/usePolling.ts` — interval fetch (2s) that stops on terminal predicate / unmount.
**Acceptance criteria:**
- [ ] Every endpoint has a typed function; responses typed (no `any`).
- [ ] `usePolling` clears its interval on unmount and when the stop predicate is true (no leaks).
- [ ] 4xx/5xx rejects with the backend error message.
**Verification:** `npm run build` (tsc) clean; temporary harness logs `getConfigAngles()` against a running backend.
**Dependencies:** T1 · **Scope:** S

#### Task 3 — UI primitive kit
**Description:** `components/ui/` encoding DS recipes: `Button` (primary/tertiary/white/destructive · sm/md/lg · loading · press-scale), `Select`, `TextInput`/`TextArea` (+ char counter), `Card`, `Tag`/`Booster`, `StatusBadge` (status→color), `Icon` (Onix SVG loader), `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`. Each colocated with its `.module.css`.
**Acceptance criteria:**
- [ ] Button matches `preview/buttons.html` recipe; keyboard-focusable; visible focus ring (2px white + 3px purps halo).
- [ ] StatusBadge maps all run + stage statuses to a DS color with **text + icon** (never color alone).
- [ ] Every primitive uses tokens only; no component > 200 lines.
**Verification:** `npm run build` clean; ad-hoc gallery route renders all variants; Tab reaches every control.
**Dependencies:** T1 · **Scope:** M

### Checkpoint A — Foundation
- [ ] `npm run build` clean, app boots, fonts + tokens load, all primitives render, routes navigable.
- [ ] **Human review of look-and-feel against the DS before building pages.**

### Phase 1: Core Flow (vertical slices — parallelizable after Checkpoint A)

#### Task 4 — Generate page
**Description:** Form (Section 3.0): Experience ID (text, with `7148`/`23604` hint), Persona, Journey Type (`pre_trip`/`in_trip`), Brand (`headout`/`non_headout`), Angle, Hook, Video Format (`9:16`/`1:1`/`16:9`/`all`), Additional details (textarea, 500-char counter). Dropdowns load from `/api/config/*` in parallel. **Smart ordering:** use `persona-angle-map` to sort/label angles (Recommended ▸ Works) on persona change, and `angle-hook-map` to sort/label hooks on angle change. Client-validate required fields, `POST /api/generate`, navigate to `/progress/:adId`.
**Acceptance criteria:**
- [ ] Dropdowns populate from live config; loading + error states while fetching.
- [ ] Angle list reorders by selected persona; hook list reorders by selected angle (Recommended group first).
- [ ] Submit blocked until valid; backend 400 shown inline near the offending field; success navigates to Progress.
**Verification:** Backend running → submit `7148` + valid inputs → 202 → lands on `/progress/:adId`. Submit empty → inline errors, no request.
**Dependencies:** T2, T3 · **Scope:** M

#### Task 5 — Progress page
**Description:** Poll `/api/status/:adId` every 2s. Render the Section 6.2 tracker: linear stages (`content_ingestion`, `script_gen`, `script_validation`, `assembly`, `export`) + **grouped** Video (one row per `video_gen_scene_*`) and Audio (`audio_gen_scene_*`) sub-rows, each with status icon + duration + cost. Dedupe retried `script_*`. Live running-cost total. Stop polling + auto-navigate to `/output/:adId` on `completed`; show ErrorState with `error_message` + "Start over" on `failed`.
**Acceptance criteria:**
- [ ] Tracker reflects live status; per-scene video/audio rows appear dynamically (4–5 scenes).
- [ ] Polling stops on `completed`/`failed` and on unmount; transitions to Output on completion.
- [ ] `failed` shows the backend `error_message` and a recovery link; running cost matches `total_cost_usd`.
**Verification:** Run a real generate → watch stages advance ✅ → auto-redirect to Output. Force a bad experience_id → `failed` state renders.
**Dependencies:** T2, T3 · **Scope:** M

#### Task 6 — Output page
**Description:** Fetch `/api/output/:adId`. Video player with **format tabs** (only formats present in `videos[]`; `<video>` `src` = returned `url`). "Download all" + per-format download links. **Cost breakdown** card (by_stage rolled to Script/Video/Audio/Assembly + total). **Claim report** card (`{ claim_text, source_field, verified }` rows with ✅/❌, "N/M verified"). Metadata strip (ad_id, experience, angle, hook). Handle 409 (not ready → bounce to Progress) and 404.
**Acceptance criteria:**
- [ ] Tabs switch formats; video plays; download links resolve to served MP4s.
- [ ] Cost card totals equal `cost_breakdown.total`; claim report renders verified/unverified with count.
- [ ] 409 redirects to Progress; 404 shows ErrorState.
**Verification:** Open a completed run → play 9:16, switch to 1:1/16:9, download works, costs/claims match `/api/output` JSON.
**Dependencies:** T2, T3 · **Scope:** M

#### Task 7 — History page
**Description:** `/api/runs` table: Ad ID, Experience, Angle, Hook, Status badge, Cost, Duration, Created (relative). Optional status filter. Row click → `/output/:adId` if `completed`, else `/progress/:adId`. Empty state ("No runs yet — generate your first ad").
**Acceptance criteria:**
- [ ] Lists runs newest-first with formatted cost/duration/relative-time; StatusBadge per row.
- [ ] Row routes correctly by status; empty state when none.
**Verification:** With ≥1 run, table renders + row navigates; filter by `completed` narrows list.
**Dependencies:** T2, T3 · **Scope:** S

### Checkpoint B — Core flow end-to-end
- [ ] Generate → Progress → Output works against the live backend for `7148`.
- [ ] History lists the run and links back into it. `npm run build` clean.
- [ ] **Human review before polish.**

### Phase 2: Polish

#### Task 8 — Responsive, accessibility & states sweep
**Description:** Verify/repair every page at 320 / 768 / 1024 / 1440px. Full keyboard nav, ARIA labels on icon-only controls, focus management on route change + async transitions, `aria-busy` on loaders. Confirm loading/empty/error states on all pages. Final DS-adherence pass (purps scarcity, sentence case, tokens-only, Onix icons).
**Acceptance criteria:**
- [ ] No horizontal scroll / overlap at the four breakpoints; tab order logical on every page; no axe-core criticals.
- [ ] No blank screens — every async surface has loading + empty + error.
- [ ] DS sweep passes (no raw hex, no title-case, no non-Onix icons).
**Verification:** Manual breakpoint + keyboard pass; axe DevTools clean of criticals; `npm run build` clean.
**Dependencies:** T4, T5, T6, T7 · **Scope:** M

### Checkpoint C — Complete
- [ ] All acceptance criteria met; build clean; ready for review/merge on `feat/08-frontend`.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Backend/DB not running during dev | High | `docker-compose up -d` + `cd backend && npm run dev` before verifying; build pages against documented contracts meanwhile. |
| `current_stage` is a label, not a stage key | Med | Progress groups `stage_logs` by prefix; never keys off `current_stage`. |
| Retried `script_*` duplicates rows | Low | Dedupe by stage name, keep latest. |
| DS font 404 (relative `url()`) | Med | Preserve `fonts/` subfolder on copy; verify 200s in Checkpoint A. |
| Calling `/api/output` before completion | Med | Progress polls `/status` only; Output handles 409 by bouncing to Progress. |

## Open Questions
- **Branch:** create `feat/08-frontend` per CLAUDE.md workflow before any code? (Assumed yes.)
- **Routing param style:** path param `/progress/:adId` (assumed) vs query `?ad_id=`. Path is cleaner; confirm if History/links elsewhere expect query form.
- **History sorting/filtering depth:** ERD says "sortable and filterable" — MVP ships newest-first + status filter; column-sort is a stretch. OK?
