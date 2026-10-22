# Tably Team · single service for Railway: the API serves the built frontend, runs Claude Code / Codex for the users
# (each with their own subscription token) and keeps everything under /data (mount a volume there).
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1
# node (for the agents, builds and Expo/Vite projects), git (own repos), chromium (reference captures)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git chromium zip unzip \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code @openai/codex pnpm \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock* ./
RUN uv sync --no-dev --frozen 2>/dev/null || uv sync --no-dev
COPY backend/app ./app
COPY --from=web /web/dist /app/frontend/dist
ENV ARENA_DATA_DIR=/data/sessions ARENA_STATIC_DIR=/app/frontend/dist ARENA_CHROME=/usr/bin/chromium \
    CLAUDE_CONFIG_DIR=/data/claude-root HOME=/data/home PORT=8000
VOLUME ["/data"]
EXPOSE 8000
CMD ["sh", "-c", "mkdir -p /data/home /data/claude-root && uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
