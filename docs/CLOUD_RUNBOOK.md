# MAET Terminal Cloud Runbook

## Local Development

Backend:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.api_server:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Backend Server Setup

1. Clone the repository to `/opt/maet-terminal`.
2. Create a Python virtual environment at `/opt/maet-terminal/.venv`.
3. Install dependencies:

```bash
/opt/maet-terminal/.venv/bin/python -m pip install -r requirements.txt
```

4. Create `/etc/maet-terminal/backend.env` with the required backend variables.
5. Do not put secrets in systemd unit files or repository files.

## systemd

```bash
sudo cp deployment/systemd/maet-backend.service.example /etc/systemd/system/maet-backend.service
sudo systemctl daemon-reload
sudo systemctl enable maet-backend
sudo systemctl start maet-backend
sudo systemctl status maet-backend
```

Logs:

```bash
sudo journalctl -u maet-backend -f
sudo journalctl -u maet-backend --since "1 hour ago"
```

Restart:

```bash
sudo systemctl restart maet-backend
```

## Nginx

```bash
sudo cp deployment/nginx/maet-backend.nginx.example /etc/nginx/sites-available/maet-backend
sudo ln -s /etc/nginx/sites-available/maet-backend /etc/nginx/sites-enabled/maet-backend
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS with certbot

```bash
sudo certbot --nginx -d api.your-domain.com
sudo nginx -t
sudo systemctl reload nginx
```

## Health Checks

```bash
curl http://127.0.0.1:8000/live
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ready
BASE_URL=https://api.your-domain.com deployment/scripts/backend-healthcheck.sh
```

## Deployment Update

```bash
cd /opt/maet-terminal
git pull --ff-only
.venv/bin/python -m pip install -r requirements.txt
pytest tests/ -q
sudo systemctl restart maet-backend
```

## Rollback

```bash
cd /opt/maet-terminal
git log --oneline -n 10
git checkout <known-good-commit>
.venv/bin/python -m pip install -r requirements.txt
sudo systemctl restart maet-backend
```

After rollback, verify:

```bash
curl http://127.0.0.1:8000/live
curl http://127.0.0.1:8000/health
sudo journalctl -u maet-backend --since "10 minutes ago"
```
