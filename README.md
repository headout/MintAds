# MintAds — AI Ad Factory

Headout sells 10,000+ experiences. Fewer than 50 have dedicated ad creative. MintAds fixes that.

Drop in a Headout experience ID → get campaign-ready UGC-style video ads (9:16, 1:1, 16:9) with every on-screen claim traced to real catalog data.

**Pipeline**: Headout catalog → Claude script → Higgsfield video + ElevenLabs VO → Remotion assembly → final MP4  
**Cost**: ~$3–6 per variant · **Time**: ~2–3 minutes · **Team**: Rushi · Rohan · Gokul

---

## Prerequisites

Install these before anything else:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) or `brew install node` |
| Docker Desktop | any | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| ffmpeg | any | `brew install ffmpeg` |

Verify:
```bash
node --version    # v18+
docker --version
ffmpeg -version
```

---

## Setup (do this once)

### 1. Clone the repo

```bash
git clone https://github.com/savaliarushi977/MintAds.git
cd MintAds
```

### 2. Fill in API keys

Open `.env` in the project root and fill in the three blank values:

```bash
# open in your editor
code .env        # VS Code
# or
nano .env
```

The three keys you need:

```
ANTHROPIC_API_KEY=       ← get from Anthropic console (ask Rushi)
HIGGSFIELD_CREDENTIALS=  ← format is KEY_ID:KEY_SECRET (ai-dev@headout subscription)
ELEVENLABS_API_KEY=      ← get from ElevenLabs account (ask Rushi)
```

Everything else in `.env` is pre-filled and works out of the box.

> `.env` is gitignored — never commit it.

### 3. Start the database

```bash
docker-compose up -d
```

This starts a local PostgreSQL container on port 5432. The schema (7 tables) and seed data (angles, hooks, personas) are applied automatically on first start.

Verify it's running:
```bash
docker-compose ps
# mintads-postgres should show "Up (healthy)"
```

### 4. Install dependencies

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd remotion && npm install && cd ..
```

---

## Running the App

Open **two terminals**:

**Terminal 1 — Backend** (API + pipeline):
```bash
cd backend
npm run dev
# Running on http://localhost:3000
```

**Terminal 2 — Frontend** (UI):
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Test the Pipeline

Once both servers are running, verify end-to-end with a real experience ID:

```bash
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
```

You'll get back `{ "ad_id": "...", "run_id": ... }`. Then poll for progress:

```bash
curl http://localhost:3000/api/status/{ad_id}
```

Or just use the UI — fill the form and hit Generate.

**Good test IDs:**
- `7148` — Colosseum, Palatine Hill & Roman Forum Pass (Rome)
- `23604` — Eiffel Tower Guided Tour by Elevator (Paris)

---

## Project Structure

```
MintAds/
├── backend/          # Express API + pipeline orchestrator (port 3000)
├── frontend/         # React + Vite UI (port 5173)
├── remotion/         # Video composition components
├── scripts/          # schema.sql + seed.sql (auto-run by Docker)
├── docs/             # PRD, ERD, execution plan
├── data/runs/        # Generated ads — created at runtime, gitignored
├── docker-compose.yml
├── .env              # Your local secrets — gitignored, never commit
└── .env.example      # Template showing all required keys
```

---

## Common Issues

**`docker-compose up -d` fails** → Make sure Docker Desktop is open and running first.

**Port 5432 already in use** → You have a local Postgres running. Either stop it (`brew services stop postgresql`) or change the port in `docker-compose.yml` and `DATABASE_URL` in `.env`.

**`ffprobe: command not found`** → Run `brew install ffmpeg`. Required for audio duration detection.

**Higgsfield call hangs** → Seedance video generation takes 60–120s per clip — this is normal. All 3 clips run in parallel so total wait is ~2 min.

**`ANTHROPIC_API_KEY` invalid** → Double-check there are no spaces or quotes around the key in `.env`.

---

## Workstream Ownership

| Area | Owner |
|------|-------|
| Backend, orchestrator, frontend, cost tracking | Rushi |
| Video engine, audio engine, Remotion assembly | Rohan |
| Creative config (angles/hooks), QA, demo prep | Gokul |
