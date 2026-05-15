# FSM Leaflet — production image.
#
# Two stages: build the client (Vite), then a slim runtime that runs the Express
# server (TypeScript via tsx, no separate compile step) and serves the built
# client dist. SQLite lives on a mounted volume (DATABASE_PATH).
#
# Node 24 chosen because node:sqlite is stable there (in 22 it's still
# experimental and prints a warning on every run).

# ---- Build client --------------------------------------------------------
FROM node:24-alpine AS client-build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund
COPY . .
RUN npm run build -w client

# ---- Runtime -------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /repo

# Playwright + Chromium need a few system libs even for the small
# chrome-headless-shell. Without these the launch fails with "missing libnss3".
RUN apk add --no-cache \
    nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont \
    chromium udev

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/
# Skip dev deps but keep tsx (it's runtime).
RUN npm install --workspaces --include-workspace-root --omit=dev --no-audit --no-fund

COPY server ./server
COPY templates ./templates
COPY reference ./reference
COPY --from=client-build /repo/client/dist ./client/dist

# SQLite path. On Render free tier this is /tmp/fsm.db (ephemeral, see render.yaml).
# On Render starter+ tier with a disk attached, override DATABASE_PATH to
# /data/fsm.db and uncomment the VOLUME line below.
ENV DATABASE_PATH=/tmp/fsm.db
# VOLUME ["/data"]

EXPOSE 4000

# Run migrations + seed on boot, then start the server. Idempotent: re-runs
# are safe on container restart. Migrations also run from inside index.ts so
# this is belt-and-braces.
CMD ["sh", "-c", "npm run migrate -w server && npm run seed -w server && npm run la:import-sites -w server -- --file=reference/sites-csv.csv 2>/dev/null || true; npx tsx server/src/index.ts"]
