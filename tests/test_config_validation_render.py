"""
Regression tests for the Render free-tier config validation path.

These tests pin the behavior of ``backend.core.config_validation`` so the
Render crash loop documented in the events tab (Exited with status 3 from
"Configuration validation failed") cannot regress. The validator must:

  * Pass in DEMO/PAPER mode even when JWT_SECRET_KEY is empty (the
    placeholder value that ``render.yaml`` ships with on the free tier).
  * Generate an ephemeral JWT secret so any token issued in that boot
    actually validates consistently.
  * Still hard-fail when ``live_trading_enabled=True`` with missing broker
    credentials, regardless of environment.
"""
from __future__ import annotations

import importlib

import pytest


def _import_validation():
    return importlib.import_module("backend.core.config_validation")


def _base_render_config() -> dict:
    """Snapshot that mimics what api_server.startup_event passes in."""
    return {
        "jwt_secret_key": "",
        "jwt_access_token_expire_minutes": 120,
        "max_order_qty": 500,
        "max_order_notional": 500_000.0,
        "trading_mode": "PAPER",
        "environment": "DEMO",
        "database_url": None,
        "db_path": "data/trades.db",
        "admin_token": "render-placeholder-admin-token-32chars-min",
        "allowed_origins": "https://indian-algo-trading-platform.vercel.app",
        "live_trading_enabled": False,
        "angel_api_key": "render-placeholder",
        "angel_client_code": "render-placeholder",
        "angel_password": "render-placeholder",
        "angel_totp_secret": "RENDERPLACETOTPSECRETDONOTUSE",
        "symbols": ["SBIN", "RELIANCE"],
    }


class TestRenderDemoDeploy:
    """Tests that match the actual render.yaml + free-tier setup."""

    def test_demo_paper_passes_with_empty_jwt(self):
        """Empty JWT secret must NOT crash a demo/paper Render deploy."""
        validation = _import_validation()
        cfg = _base_render_config()
        assert cfg["jwt_secret_key"] == ""

        result = validation.validate_trading_config(cfg)

        # Ephemeral secret should have been generated and stored on the dict
        # so any later token issuance during this boot uses a consistent key.
        assert result["jwt_secret_key"], "Ephemeral JWT secret was not generated"
        assert len(result["jwt_secret_key"]) >= 32, "Ephemeral secret is too short"

    def test_demo_paper_validate_all_returns_clean(self):
        """End-to-end validate_all_config must pass in the Render config."""
        validation = _import_validation()
        cfg = _base_render_config()

        result = validation.validate_all_config(cfg)
        assert result["jwt_secret_key"], "Ephemeral JWT secret missing"

    def test_local_mode_passes_with_empty_jwt(self):
        """LOCAL mode (developer machine) is also a demo/paper tier."""
        validation = _import_validation()
        cfg = _base_render_config()
        cfg["environment"] = "LOCAL"
        cfg["jwt_secret_key"] = ""

        result = validation.validate_trading_config(cfg)
        assert result["jwt_secret_key"]

    def test_development_mode_passes_with_empty_jwt(self):
        validation = _import_validation()
        cfg = _base_render_config()
        cfg["environment"] = "DEVELOPMENT"
        cfg["jwt_secret_key"] = ""

        result = validation.validate_trading_config(cfg)
        assert result["jwt_secret_key"]


class TestStrictModeEnforcement:
    """Make sure the relaxation does NOT weaken production or live trading."""

    def test_production_with_empty_jwt_fails(self):
        validation = _import_validation()
        cfg = _base_render_config()
        cfg["environment"] = "PRODUCTION"
        cfg["database_url"] = "postgresql://user:pass@host:5432/prod"
        cfg["jwt_secret_key"] = ""
        cfg["live_trading_enabled"] = True

        with pytest.raises(validation.ConfigValidationError) as excinfo:
            validation.validate_trading_config(cfg)
        assert "JWT secret key is required" in str(excinfo.value)

    def test_live_trading_enabled_with_empty_broker_fails(self):
        validation = _import_validation()
        cfg = _base_render_config()
        cfg["live_trading_enabled"] = True
        cfg["angel_api_key"] = ""

        with pytest.raises(validation.ConfigValidationError) as excinfo:
            validation.validate_broker_config(cfg)
        assert "angel_api_key is required" in str(excinfo.value)

    def test_unknown_environment_fails(self):
        validation = _import_validation()
        cfg = _base_render_config()
        cfg["environment"] = "FOO"
        cfg["live_trading_enabled"] = True

        with pytest.raises(validation.ConfigValidationError) as excinfo:
            validation.validate_trading_config(cfg)
        assert "Environment must be" in str(excinfo.value)


class TestEmptyEnvironmentFallback:
    """When ENVIRONMENT is unset/empty, the validator must default to LOCAL
    (the safest paper-trading tier) instead of crashing. This is the
    actual scenario Render hit at 2026-06-11 09:01 UTC."""

    def test_empty_environment_defaults_to_local_and_passes(self):
        """Environment='' is a Render bug we observed; must not crash."""
        validation = _import_validation()
        cfg = _base_render_config()
        cfg["environment"] = ""
        cfg["jwt_secret_key"] = ""

        result = validation.validate_trading_config(cfg)

        # Empty env should be coerced to LOCAL so downstream code that
        # checks the environment value sees a real tier.
        assert result["environment"] == "LOCAL"
        # And ephemeral JWT secret still gets generated.
        assert result["jwt_secret_key"]
        assert len(result["jwt_secret_key"]) >= 32

    def test_whitespace_environment_defaults_to_local(self):
        """Same as above but with whitespace — also Render-observed."""
        validation = _import_validation()
        cfg = _base_render_config()
        cfg["environment"] = "   "
        cfg["jwt_secret_key"] = ""

        result = validation.validate_trading_config(cfg)
        assert result["environment"] == "LOCAL"
        assert result["jwt_secret_key"]

    def test_environment_key_missing_completely(self):
        """What if the environment key is absent from the dict entirely."""
        validation = _import_validation()
        cfg = _base_render_config()
        del cfg["environment"]
        cfg["jwt_secret_key"] = ""

        result = validation.validate_trading_config(cfg)
        assert result["environment"] == "LOCAL"
        assert result["jwt_secret_key"]
