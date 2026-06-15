# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — install dependencies (compiles the native better-sqlite3 binary)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Build toolchain required to compile better-sqlite3 from source.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install with the lockfile. Dev deps are kept on purpose: the server runs
# its TypeScript directly via `tsx`, which is a devDependency.
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2 — runtime (Express API only; nginx serves the built Vue frontend)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Reuse the compiled node_modules (incl. better-sqlite3 + tsx) from the deps stage.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server
COPY data ./data
COPY model ./model

# The app opens "excuselist.db" relative to the process working directory.
# We run with cwd=/data and mount a volume there, so the DB (and any future
# state) persists outside the image. The schema is auto-created on first start.
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

USER node
WORKDIR /data
EXPOSE 3000

# Required env (server refuses to start without them): JWT_SECRET,
# UNTIS_SCHOOL, UNTIS_BASE_URL. Pass them at runtime, never bake into the image.
#
# Entry is referenced by absolute path so the working directory stays /data
# (where excuselist.db lives).
CMD ["/app/node_modules/.bin/tsx", "/app/server/src/index.ts"]
