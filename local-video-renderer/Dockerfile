FROM node:24-bookworm-slim

ENV NODE_ENV=production
ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.bun/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 \
    libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 \
    libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 \
    libcairo2 libcups2 fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash

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
