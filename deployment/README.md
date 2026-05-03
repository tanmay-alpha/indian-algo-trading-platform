# MAET Terminal Deployment Assets

This directory contains example deployment files for the FastAPI backend.

- `systemd/maet-backend.service.example`: long-running backend service.
- `nginx/maet-backend.nginx.example`: reverse proxy with WebSocket upgrade support.
- `scripts/backend-healthcheck.sh`: safe local healthcheck.
- `scripts/deploy-backend.sh.example`: example VPS update/restart flow.

All files use placeholders. Do not put credentials directly in these files.
