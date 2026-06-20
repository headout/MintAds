# MintAds Chunk 8 — Frontend TODO

Branch: `feat/08-frontend` · Stack: React + Vite + react-router-dom + CSS Modules + Headout DS tokens
Backend (Chunk 7) is live; this is UI-only against documented contracts.

## Phase 0 — Foundation
- [ ] **T1** Deps + DS tokens/fonts copied (preserve `fonts/`) + `AppShell` + router (4 routes)
- [ ] **T2** Typed `api.ts` + `types.ts` + `usePolling` (2s, stops on terminal/unmount)
- [ ] **T3** UI primitive kit — Button, Select, TextInput/TextArea, Card, Tag/Booster, StatusBadge, Icon, Spinner, Skeleton, EmptyState, ErrorState

### ✅ Checkpoint A — build clean, fonts+tokens load, primitives render, routes navigable → **human review**

## Phase 1 — Core flow (T4–T7 parallelizable after Checkpoint A)
- [ ] **T4** Generate page — config dropdowns + smart angle/hook ordering (persona-angle-map, angle-hook-map) + validation + POST /generate → /progress/:adId
- [ ] **T5** Progress page — poll /status 2s, grouped video/audio scene rows, dedupe script retries, running cost, auto→Output on completed, failed state
- [ ] **T6** Output page — format tabs + player (use returned `url`) + downloads + cost breakdown + claim report + metadata; handle 409/404
- [ ] **T7** History page — /runs table (status badge, cost, duration, relative time), row→Output|Progress by status, empty state

### ✅ Checkpoint B — Generate→Progress→Output works on `7148`; History links back; build clean → **human review**

## Phase 2 — Polish
- [ ] **T8** Responsive (320/768/1024/1440) + a11y (keyboard, ARIA, focus, axe) + all loading/empty/error states + final DS sweep

### ✅ Checkpoint C — all criteria met, build clean, ready to merge

---
### Hard rules (do not drift)
- Purps `#8000ff` scarce (CTA/active/brand only); white + grey-50 are the workhorses
- Sentence case everywhere; confident second-person voice
- Tokens only — no raw hex, no off-scale px; Onix icons only (no emoji-as-icon/Lucide)
- Radius 12 default; press scale(0.95); hover = tone shift not opacity; `--shadow-1`→`-2`
- Use `/api/output` `url` verbatim; never call /output before `completed`; group stage_logs (don't key off `current_stage`)
