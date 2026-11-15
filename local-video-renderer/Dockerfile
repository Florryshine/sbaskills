FROM node:24-bookworm-slim

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
    libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 \
    libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 \
    libcairo2 libcups2 fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global bun

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY whiteboard-engine/package.json whiteboard-engine/bun.lock ./whiteboard-engine/

WORKDIR /app/whiteboard-engine

RUN bun install --frozen-lockfile --production
RUN ./node_modules/.bin/remotion browser ensure

WORKDIR /app

COPY whiteboard-engine/ ./whiteboard-engine/
COPY lib/ ./lib/
COPY local-video-renderer/whiteboard-worker.js ./local-video-renderer/whiteboard-worker.js

CMD ["bun", "local-video-renderer/whiteboard-worker.js"]
