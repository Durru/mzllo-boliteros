FROM node:24-slim AS base
WORKDIR /app

# Install build dependencies for native modules (sharp, better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Runtime stage
FROM node:24-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/src ./src
COPY --from=base /app/tsconfig.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DB_PATH=/app/data/mzllo.db

EXPOSE 3000

CMD ["node", "--import", "node:sqlite", "src/web/index.ts"]
