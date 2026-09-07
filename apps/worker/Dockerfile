# Build context is the repo root, not this directory:
#   fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile
FROM node:22-slim

# yt-dlp needs python; ffmpeg is what it shells out to for stream handling.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ffmpeg ca-certificates \
 && pip3 install --break-system-packages --no-cache-dir yt-dlp \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@12.3.4

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

# "@zenow/worker..." means the worker and everything it depends on, built in
# dependency order. Dev dependencies are needed for tsc, then dropped.
RUN pnpm install --frozen-lockfile --filter "@zenow/worker..." \
 && pnpm --filter "@zenow/worker..." build \
 && pnpm install --prod --frozen-lockfile --filter "@zenow/worker..." \
 && pnpm store prune

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "apps/worker/dist/index.js"]
