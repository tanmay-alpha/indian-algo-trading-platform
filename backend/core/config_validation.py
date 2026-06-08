"""
Custom configuration validators for the trading platform.
This module provides validation logic for critical configuration values.
"""

import logging
from typing import Dict, Any, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""
    pass


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

    # Validate JWT configuration
    if not settings.get("jwt_secret_key"):
        errors.append("JWT secret key is required")

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

    # Validate environment
    if settings.get("environment") not in ["LOCAL", "DEMO", "PRODUCTION"]:
        errors.append("Environment must be LOCAL, DEMO, or PRODUCTION")

    # Validate database path
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

    if errors:
        raise ConfigValidationError("\n".join(errors))

    logger.info("Configuration validation passed")
    return settings


def validate_security_config(settings: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate security-related configuration values.

    Args:
        settings: Dictionary of configuration values

    Returns:
        Validated configuration

    Raises:
        ConfigValidationError: If validation fails
    """
    errors = []

    # Validate admin token
    if settings.get("admin_token"):
        if len(settings["admin_token"]) < 32:
            errors.append("Admin token should be at least 32 characters long")

        # Check for common weak tokens
        if settings["admin_token"].startswith("admin") or settings["admin_token"].startswith("test"):
            errors.append("Admin token should not start with common patterns like 'admin' or 'test'")

    # Validate CORS origins
    allowed_origins = settings.get("allowed_origins", "").split(",")
    for origin in allowed_origins:
        origin = origin.strip()
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

    Args:
        settings: Dictionary of configuration values

    Returns:
        Validated configuration

    Raises:
        ConfigValidationError: If any validation fails
    """
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