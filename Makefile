.PHONY: install dev backend frontend langfuse langfuse-down up down test check

install:            ## instala deps de backend (uv) y frontend (npm)
	cd backend && uv sync
	cd frontend && npm install

backend:            ## API en :8000 (sin autoreload: un reload mata las construcciones en curso)
	cd backend && uv run uvicorn app.main:app --port 8000

backend-reload:     ## API con autoreload, solo para desarrollar el backend sin trabajos corriendo
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:           ## UI en :5173 (proxy a :8000)
	cd frontend && npm run dev

dev:                ## backend + frontend juntos
	$(MAKE) -j2 backend frontend

langfuse:           ## Langfuse self-hosted en :3000
	docker compose -p arena-langfuse -f docker-compose.langfuse.yml --env-file .env up -d

langfuse-down:
	docker compose -p arena-langfuse -f docker-compose.langfuse.yml down

up:                 ## app dockerizada en :8080
	docker compose up -d --build

down:
	docker compose down

test:               ## tests del backend (pytest, con agentes simulados)
	cd backend && uv run pytest -q

check:              ## tests + typecheck + build del frontend
	$(MAKE) test
	cd frontend && npx tsc -b && npm run build
