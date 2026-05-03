# MAET Terminal Deployment

MAET Terminal is deployed as two separate services:

- Frontend: Next.js app in `frontend/`, deployed on Vercel.
- Backend: FastAPI app in `backend/`, deployed on a VPS/cloud VM.

The backend must not be deployed to Vercel. It maintains long-running broker sessions, WebSocket market data, EventBus/TickBus processing, candle state, execution safety state, and portfolio state. These require a persistent process and stable network egress.

## Vercel Frontend

Use these Vercel settings:

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `.next`

Frontend environment variables:

- `NEXT_PUBLIC_API_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_WS_URL=wss://api.your-domain.com/ws/market_stream`

## VPS Backend

Run the backend as a long-running process:

```bash
uvicorn backend.api_server:app --host 0.0.0.0 --port 8000
```

For production-style operation, use:

- systemd service from `deployment/systemd/maet-backend.service.example`
- Nginx reverse proxy from `deployment/nginx/maet-backend.nginx.example`
- HTTPS certificate via certbot

## HTTPS and WSS

Browser WebSocket connections from the Vercel frontend should use `wss://`.
Terminate HTTPS at Nginx and proxy to the backend on `127.0.0.1:8000`.

SmartAPI usage should run from the VPS backend only, not from Vercel.
