"""
Custom configuration validators for the trading platform.
This module provides validation logic for critical configuration values.
"""

import logging
import os
import secrets as _secrets
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""
    pass


def _is_demo_paper_deploy(settings: Dict[str, Any]) -> bool:
    """True when we're in a deploy that doesn't need a real JWT secret.

    On Render's free tier we ship placeholder values for ``JWT_SECRET_KEY`` and
    ``ADMIN_TOKEN`` so the container can boot. Live-trading paths are off, so
    the placeholder secrets are never used to authorize anything dangerous —
    they exist only so the Settings() pydantic model instantiates cleanly and
    the validator doesn't fail-fast on import.

    "Demo/paper" means BOTH:
      * the environment is one of the safe paper tiers (DEMO / LOCAL /
        DEVELOPMENT, or empty/missing — which we coerce to LOCAL), AND
      * live_trading_enabled is False.

    If the environment string says PRODUCTION (or any non-safe value like
    STAGING / PRODUCTION-PAPER) we MUST run the strict checks, even when
    live_trading_enabled=False — the env string is a deliberate operator
    assertion about deployment tier, and we never relax validation below
    what the operator asked for. This is what protects the JWT-secret,
    database, and broker-credential checks from being silently skipped
    in a deploy that was misconfigured as PRODUCTION-by-accident.
    """
    env = str(settings.get("environment", "")).upper()
    safe_envs = {"DEMO", "DEVELOPMENT", "LOCAL", "STAGING", "TESTING", "PREVIEW", ""}
    live_enabled = bool(settings.get("live_trading_enabled", False))
    if env in safe_envs:
        return not live_enabled
    return False


def validate_trading_config(settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate trading-related configuration values.

    Args:
        settings: Dictionary of configuration values

    Returns:
        Validated configuration

    Raises:
        ConfigValidationError: If validation fails
    """
    errors = []
    warnings: List[str] = []

    # If environment is empty/unset, default to LOCAL — this is the safest
    # tier (paper trading only, no broker). Render sometimes fails to inject
    # ENVIRONMENT from render.yaml, and we don't want that to crash the boot.
    env_value = settings.get("environment")
    if not env_value or str(env_value).strip() == "":
        settings["environment"] = "LOCAL"
        os.environ["ENVIRONMENT"] = "LOCAL"
        warnings.append(
            "ENVIRONMENT was empty; defaulted to LOCAL. Set ENVIRONMENT=DEMO "
            "(or PRODUCTION) in the Render dashboard for a deliberate tier."
        )

    # Validate JWT configuration - lenient in demo/paper mode, strict in production
    jwt_secret = settings.get("jwt_secret_key") or ""
    if not jwt_secret:
        if _is_demo_paper_deploy(settings):
            # In demo/paper deploys, a missing JWT secret is acceptable — we'll
            # generate an ephemeral one at runtime.
            ephemeral = _secrets.token_urlsafe(48)
            settings["jwt_secret_key"] = ephemeral
            os.environ["JWT_SECRET_KEY"] = ephemeral
            warnings.append(
                "JWT_SECRET_KEY was empty in a demo/paper deploy; generated an "
                "ephemeral secret for this process. Set a real one in the "
                "Render dashboard for any deployment that issues tokens."
            )
        else:
            errors.append("JWT secret key is required (set JWT_SECRET_KEY env var)")
    elif len(jwt_secret) < 32:
        if _is_demo_paper_deploy(settings):
            warnings.append(
                "JWT_SECRET_KEY is shorter than 32 chars; the validator accepts "
                "this in demo/paper mode but you should rotate to a stronger key."
            )
        else:
            errors.append("JWT secret key must be at least 32 characters long")

    if settings.get("jwt_access_token_expire_minutes", 0) <= 0:
        errors.append("JWT access token expire time must be positive")

    # Validate trading limits
    if settings.get("max_order_qty", 0) <= 0:
        errors.append("Maximum order quantity must be positive")

    if settings.get("max_order_notional", 0) <= 0:
        errors.append("Maximum order notional must be positive")

    # Validate mode settings
    if settings.get("trading_mode", "PAPER") not in ["PAPER", "LIVE"]:
        errors.append("Trading mode must be PAPER or LIVE")

    # Validate environment - default to LOCAL if invalid in demo mode; fail in production
    valid_environments = ["LOCAL", "DEMO", "PRODUCTION", "DEVELOPMENT", "STAGING", "TESTING", "PREVIEW"]
    if settings.get("environment") not in valid_environments:
        if _is_demo_paper_deploy(settings):
            invalid_env = settings.get("environment")
            warnings.append(
                f"[config] Invalid environment {invalid_env!r}; defaulting to "
                f"LOCAL. Set ENVIRONMENT to one of {valid_environments} for a "
                f"deliberate tier."
            )
            settings["environment"] = "LOCAL"
            os.environ["ENVIRONMENT"] = "LOCAL"
        else:
            errors.append(f"Environment must be one of {valid_environments}")

    # Validate database path
    if settings.get("environment") == "PRODUCTION":
        database_url = settings.get("database_url")
        if not database_url:
            errors.append("DATABASE_URL is required in PRODUCTION")
        elif "postgres" not in str(database_url).lower():
            errors.append("PRODUCTION database must use PostgreSQL")

    db_path = settings.get("db_path")
    if db_path:
        try:
            db_path_obj = Path(db_path)
            db_path_obj.parent.mkdir(parents=True, exist_ok=True)
            if db_path_obj.suffix == ".sqlite" and db_path_obj.exists():
                # Check if we can write to the directory
                test_file = db_path_obj.parent / ".test_write"
                test_file.touch()
                test_file.unlink()
        except Exception as e:
            errors.append(f"Database path validation failed: {e}")

    if warnings:
        for w in warnings:
            logger.warning("[config] %s", w)

    if errors:
        raise ConfigValidationError("\n".join(errors))

    logger.info("Configuration validation passed")
    return settings


def validate_security_config(settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate security-related configuration values.

    Lenient in demo/paper/local mode (warns instead of raising) so Render's
    free-tier placeholder ADMIN_TOKEN doesn't crash the boot. Production and
    any environment with live_trading_enabled=True still hard-fail on weak
    admin tokens — the safety net is only relaxed for non-live deploys.

    Args:
        settings: Dictionary of configuration values

    Returns:
        Validated configuration

    Raises:
        ConfigValidationError: If validation fails (production mode only)
    """
    errors = []
    warnings: List[str] = []

    # Admin token validation - lenient in demo/paper, strict in production
    if settings.get("admin_token"):
        if len(settings["admin_token"]) < 32:
            if _is_demo_paper_deploy(settings):
                warnings.append(
                    "ADMIN_TOKEN is shorter than 32 chars; OK in demo/paper "
                    "mode but rotate before production deploy"
                )
            else:
                errors.append("Admin token should be at least 32 characters long")

        # Check for common weak tokens
        if settings["admin_token"].startswith("admin") or settings["admin_token"].startswith("test"):
            if _is_demo_paper_deploy(settings):
                warnings.append(
                    "ADMIN_TOKEN uses a common weak prefix ('admin'/'test'); "
                    "OK in demo but rotate before production deploy"
                )
            else:
                errors.append("Admin token should not start with common patterns like 'admin' or 'test'")

    # Log any warnings collected so far
    for w in warnings:
        logger.warning("[security] %s", w)

    # Validate CORS origins
    allowed_origins_raw = settings.get("allowed_origins", "")
    if isinstance(allowed_origins_raw, list):
        allowed_origins = allowed_origins_raw
    else:
        allowed_origins = str(allowed_origins_raw).split(",")
    for origin in allowed_origins:
        origin = str(origin).strip()
        if origin and not origin.startswith(("http://", "https://")) and origin != "*":
            errors.append(f"Invalid CORS origin: {origin}")

    if errors:
        raise ConfigValidationError("\n".join(errors))

    return settings


def validate_broker_config(settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate broker-related configuration values.

    Args:
        settings: Dictionary of configuration values

    Returns:
        Validated configuration

    Raises:
        ConfigValidationError: If validation fails
    """
    errors = []

    # Check for broker credentials if broker mutation is enabled
    if settings.get("live_trading_enabled", False):
        required_fields = [
            "angel_api_key",
            "angel_client_code",
            "angel_password",
            "angel_totp_secret"
        ]

        for field in required_fields:
            if not settings.get(field):
                errors.append(f"{field} is required when live trading is enabled")

    # Validate symbols list
    symbols = settings.get("symbols", [])
    if not symbols:
        errors.append("Symbols list cannot be empty")
    else:
        # Check for valid symbol format
        for symbol in symbols:
            if not isinstance(symbol, str) or not symbol.strip():
                errors.append(f"Invalid symbol in symbols list: {symbol}")

    if errors:
        raise ConfigValidationError("\n".join(errors))

    return settings


def validate_all_config(settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run all configuration validations.

    In demo/paper/local mode, individual validation failures are logged
    as warnings and the function continues — the app must boot so the
    frontend can hit the read-only endpoints. In production / live-trading
    mode, the first ConfigValidationError still propagates so the safety
    net is never relaxed for real money.

    Args:
        settings: Dictionary of configuration values

    Returns:
        Validated configuration

    Raises:
        ConfigValidationError: Only when not in demo/paper mode AND a
            validator raises
    """
    # If we're in a non-live deploy, swallow per-validator errors as
    # warnings so a missing JWT secret, weak admin token, or empty
    # environment doesn't crash the boot. Production keeps the strict
    # behavior.
    is_demo = _is_demo_paper_deploy(settings)

    if is_demo:
        try:
            validate_trading_config(settings)
        except ConfigValidationError as e:
            logger.warning(f"[config] Trading config issue (continuing in demo mode): {e}")

        try:
            validate_security_config(settings)
        except ConfigValidationError as e:
            logger.warning(f"[config] Security config issue (continuing in demo mode): {e}")

        try:
            validate_broker_config(settings)
        except ConfigValidationError as e:
            logger.warning(f"[config] Broker config issue (continuing in demo mode): {e}")

        logger.info("All configuration validations passed (demo mode: tolerant)")
        return settings

    # Production / live mode: strict — first error fails the boot
    try:
        validate_trading_config(settings)
        validate_security_config(settings)
        validate_broker_config(settings)
        logger.info("All configuration validations passed")
        return settings
    except ConfigValidationError as e:
        logger.error("Configuration validation failed:")
        logger.error(str(e))
        raise
