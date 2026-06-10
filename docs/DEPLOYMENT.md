# MAET Terminal Deployment

MAET Terminal is deployed as two separate services:

- Frontend: Next.js app in `frontend/`, deployed on Vercel.
- Backend: FastAPI app in `backend/`, deployed on Render, VPS, or another persistent Python host.

The backend should not run as a Vercel frontend function. It maintains broker sessions, WebSocket market data, EventBus/TickBus processing, candle state, execution safety state, and portfolio state.

## Vercel Frontend

Use these Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `.next`

Frontend environment variables:

- `NEXT_PUBLIC_BACKEND_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_API_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_WS_URL=wss://api.your-domain.com/ws/market_stream`

## Backend

Run the backend as a long-running process:

```bash
uvicorn backend.api_server:app --host 0.0.0.0 --port 8000 --ws-ping-interval 20 --ws-ping-timeout 30
```

Render start command:

```bash
uvicorn backend.api_server:app --host 0.0.0.0 --port $PORT --ws-ping-interval 20 --ws-ping-timeout 30
```

## Database

Production requires PostgreSQL:

```text
DATABASE_URL=postgresql://user:password@host:5432/maet_terminal
ENVIRONMENT=PRODUCTION
```

Local development can use the Postgres service in `docker-compose.yml`:

```bash
docker compose up -d postgres
alembic upgrade head
```

SQLite remains available only as a local/test fallback when `DATABASE_URL` is not set.

## API Docs

The backend serves Swagger UI at:

```text
https://api.your-domain.com/docs
```

OpenAPI JSON is available at `/openapi.json`.

## HTTPS And WSS

Browser WebSocket connections from the Vercel frontend should use `wss://`.
Terminate HTTPS at Nginx or the hosting provider and proxy to the backend process.

SmartAPI usage should run from the backend only, not from Vercel.
