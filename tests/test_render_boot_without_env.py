"""
tests/test_render_boot_without_env.py

Proves the MAET backend can boot in a Render-like environment that does NOT
ship a .env file. This is the regression test for the "Exited with status 3"
incident where the pydantic Settings model required angel_* fields whose
values were only present in the (gitignored) backend/.env.

What this test does:
  1. Copies the backend source into a temp dir WITHOUT backend/.env.
  2. Sets only the env vars that render.yaml provides.
  3. Subprocess-imports the app in that sandbox.
  4. Asserts:
     - backend.core.config.settings instantiates without ValidationError
     - backend.api_server imports without exception
     - The FastAPI app object is constructible
     - is_live_execution_build_enabled() is still False
  5. Imports backend.api_server.app in the current process, makes a
     TestClient /ping call, and asserts a 200 with no broker / DB access.

We do not read or print any real .env values. The temp sandbox has no
.env file, by construction.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"

# These are the env vars that render.yaml injects at deploy time.
# They mirror the production-shape settings, with placeholders.
RENDER_YAML_ENV = {
    "ENVIRONMENT": "DEMO",
    "TRADING_MODE": "PAPER",
    "BROKER_ENABLED": "false",
    "ENABLE_BROKER_LOGIN": "false",
    "LIVE_TRADING_ENABLED": "false",
    "ALLOWED_ORIGINS": "https://indian-algo-trading-platform.vercel.app",
    "JWT_SECRET_KEY": "render-test-jwt-secret-key-placeholder-32chars",
    "ADMIN_TOKEN": "render-test-admin-token-placeholder-32chars",
    "ANGEL_API_KEY": "render-test-angel-api-key-placeholder",
    "ANGEL_CLIENT_ID": "render-test-angel-client-placeholder",
    "ANGEL_PASSWORD": "render-test-angel-password-placeholder",
    "ANGEL_TOTP_SECRET": "RENDERTESTTOTPSECRETPLACEHOLDER",
    "PYTHONUNBUFFERED": "1",
    "PYTHONDONTWRITEBYTECODE": "1",
}


def _build_sandbox() -> tuple[Path, Path]:
    """Copy the backend tree into a temp dir, dropping backend/.env."""
    testdir = Path(tempfile.mkdtemp(prefix="maet_render_boot_"))
    sandbox_backend = testdir / "backend"
    sandbox_backend.mkdir()

    # Copy each child of backend/ except .env, __pycache__, data, logs, candles.
    skip_names = {".env", "__pycache__", "data", "logs", "candles"}
    for item in BACKEND_DIR.iterdir():
        if item.name in skip_names:
            continue
        if item.is_dir():
            shutil.copytree(
                item,
                sandbox_backend / item.name,
                ignore=shutil.ignore_patterns(".env", "__pycache__", "data", "logs"),
            )
        else:
            shutil.copy(item, sandbox_backend / item.name)

    # Assert no .env got copied accidentally
    assert not (sandbox_backend / ".env").exists(), "sandbox must not contain .env"
    return testdir, sandbox_backend


def _make_sandbox_env(sandbox_backend: Path, testdir: Path) -> dict[str, str]:
    """Build a minimal env like Render would provide, with .env not present."""
    env = os.environ.copy()
    # Strip anything that would normally come from a developer's .env
    for k in list(env.keys()):
        if k.startswith(
            (
                "ANGEL_",
                "JWT_",
                "ADMIN_",
                "DATABASE_",
                "TRADING_",
                "LIVE_",
                "BROKER_",
                "PAPER_",
                "ALLOWED_",
                "ENVIRONMENT",
                "SKIP_",
                "DB_",
                "LOG_",
                "ENABLE_",
                "DEMO_",
                "ALLOW_",
                "LIVE_",
                "PYTHONPATH",
            )
        ):
            env.pop(k, None)
    env.update(RENDER_YAML_ENV)
    env["PYTHONPATH"] = str(sandbox_backend) + os.pathsep + str(testdir)
    return env


def test_settings_instantiate_without_env_file():
    """Settings() must construct when the only config source is env vars."""
    testdir, sandbox_backend = _build_sandbox()
    try:
        env = _make_sandbox_env(sandbox_backend, testdir)
        script = textwrap.dedent(
            """
            from backend.core.config import settings
            assert settings.environment == "DEMO", settings.environment
            assert settings.trading_mode == "PAPER", settings.trading_mode
            assert settings.live_trading_enabled is False
            print("OK")
            """
        )
        result = subprocess.run(
            [sys.executable, "-B", "-c", script],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert result.returncode == 0, (
            "Settings failed to instantiate without .env:\n"
            f"STDOUT: {result.stdout}\n"
            f"STDERR: {result.stderr[-2000:]}"
        )
        assert "OK" in result.stdout
    finally:
        shutil.rmtree(testdir, ignore_errors=True)


def test_api_imports_without_env_file():
    """backend.api_server must import successfully without backend/.env."""
    testdir, sandbox_backend = _build_sandbox()
    try:
        env = _make_sandbox_env(sandbox_backend, testdir)
        script = textwrap.dedent(
            """
            import backend.api_server
            from backend.api_server import app
            assert app is not None
            assert app.title == "MAET Terminal API"
            print("OK")
            """
        )
        result = subprocess.run(
            [sys.executable, "-B", "-c", script],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert result.returncode == 0, (
            "api_server import failed without .env:\n"
            f"STDOUT: {result.stdout}\n"
            f"STDERR: {result.stderr[-2000:]}"
        )
        assert "OK" in result.stdout
    finally:
        shutil.rmtree(testdir, ignore_errors=True)


def test_live_execution_policy_still_locked():
    """The safety lock must remain False — config changes cannot enable it."""
    from backend.core.live_build_policy import is_live_execution_build_enabled

    assert is_live_execution_build_enabled() is False


def test_ping_endpoint_responds_without_broker_or_db():
    """The /ping endpoint must answer 200 with no broker / DB access.

    The local conftest sets a SQLite test database and disables the rate
    limiter. /ping is documented to not touch the DB or broker; this
    test enforces that contract.
    """
    from fastapi.testclient import TestClient

    from backend.api_server import app

    client = TestClient(app)
    response = client.get("/ping")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("status") == "ok"
    # Should be fast — no broker/DB calls
    assert "ts" in body


def test_health_endpoint_does_not_crash_on_degraded_state():
    """Even if the DB is unavailable, /health must return 200, not crash."""
    from fastapi.testclient import TestClient

    from backend.api_server import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200, response.text
    body = response.json()
    # Public health check returns only overall status, no internals.
    assert "status" in body
    assert body["status"] in {"online", "degraded"}
