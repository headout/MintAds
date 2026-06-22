# ── Stage 1: build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: compile backend TypeScript ──────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

# ffmpeg (includes ffprobe) — required for audio duration probing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend production deps — @remotion/renderer downloads its Chromium here via postinstall
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Remotion compositions — bundled at server startup via @remotion/bundler (webpack)
COPY remotion/package*.json ./remotion/
RUN cd remotion && npm ci
COPY remotion/src/ ./remotion/src/

# Compiled backend JS
COPY --from=backend-builder /build/backend/dist ./backend/dist

# Frontend static files — served by Express on the same origin
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# DB schema scripts (for reference / manual migration in Railway)
COPY scripts/ ./scripts/

# Volume mount point for generated video/audio artifacts
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
