# Local Docker Development Setup

This document describes how to set up and run the local database (PostgreSQL) and caching/session store (Redis) infrastructure for MAET Terminal using Docker Compose.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (ensure it is running on your machine)
- Python 3.11+ (local virtual environment configured)

## Docker Services

Docker Compose defines two services for local development:
1. **PostgreSQL 16**: Port `5432` — Main relational database.
2. **Redis 7**: Port `6379` — Used for caching, rate limiting, and future background jobs.

---

## Usage Commands

### 1. Start the Docker Services

To spin up the local PostgreSQL and Redis instances in detached mode:

```bash
docker compose up -d postgres redis
```

Verify that the containers are running:

```bash
docker compose ps
```

### 2. Configure Environment Variables

Create or update your local `.env` file with the following settings to point to the local Docker services:

```env
DATABASE_URL=postgresql://maet:maet_dev_password@localhost:5432/maet_terminal
REDIS_URL=redis://localhost:6379/0
TRADING_MODE=PAPER
LIVE_TRADING_ENABLED=false
LIVE_EXECUTION_ENABLED=false
ALLOW_LIVE_ORDERS=false
LIVE_APPROVAL_SANDBOX_ENABLED=false
```

> [!NOTE]
> The backend will automatically fall back to local SQLite at `data/trades.db` if `DATABASE_URL` is omitted or empty.

### 3. Run Database Migrations

Apply the database schema migrations to the local PostgreSQL instance:

```bash
python scripts/db_migrate.py upgrade
```

### 4. Verify Backend Import

Confirm the backend server starts and imports successfully:

```bash
python -B -c "import backend.api_server; print('api import ok')"
```

### 5. Run Test Suite

Verify all tests pass successfully in the local workspace environment:

```bash
pytest tests/ -q
```

### 6. Stop the Docker Services

To stop and remove the containers without destroying data:

```bash
docker compose down
```

### 7. Reset Database (Wipe Data)

To completely reset the database volumes and wipe all data:

```bash
docker compose down -v
```

---

## Safety Guidelines

> [!WARNING]
> **Database Access Rule**: The frontend must never connect directly to the database. All operations must be routed through the FastAPI backend.
>
> **Live Trading Lock**: Live execution/trading remains completely disabled at the build level. `BUILD_LIVE_EXECUTION_ALLOWED` is hard-locked to `False`. Do not attempt to modify this value.
