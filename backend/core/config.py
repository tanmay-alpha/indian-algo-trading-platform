from pathlib import Path
from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, DotEnvSettingsSource, PydanticBaseSettingsSource, SettingsConfigDict


class Settings(BaseSettings):
    angel_api_key: str
    angel_client_code: str = Field(validation_alias=AliasChoices("ANGEL_CLIENT_CODE", "ANGEL_CLIENT_ID"))
    angel_password: str
    angel_totp_secret: str
    symbols: list[str] = [
        "SBIN",
        "RELIANCE",
        "INFY",
        "TCS",
        "HDFCBANK",
        "ICICIBANK",
        "AXISBANK",
        "WIPRO",
        "ITC",
        "TATASTEEL",
    ]
    host: str = "0.0.0.0"
    port: int = 8000
    trading_mode: str = "PAPER"
    log_level: str = "INFO"
    log_dir: str = "logs"
    db_path: str = "data/trades.db"
    database_url: Optional[str] = None
    database_echo: bool = False
    database_pool_size: int = 5
    database_backend: Optional[str] = None
    max_order_qty: int = 500
    max_order_notional: float = 500000.0
    max_daily_loss: float = -25000.0
    jwt_refresh_interval_minutes: int = 30
    jwt_secret_key: str = "supersecretchangeinprod"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 120
    ws_reconnect_delay_seconds: int = 3
    live_trading_enabled: bool = False
    live_approval_sandbox_enabled: bool = False
    demo_mode: bool = False
    admin_token: str = ""
    allowed_origins: str = "http://localhost:3000"
    environment: str = "LOCAL"
    public_backend_url: Optional[str] = None
    strategy_scheduler_enabled: bool = False

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @property
    def inferred_database_backend(self) -> str:
        if self.database_backend:
            val = self.database_backend.lower()
            if "postgres" in val:
                return "postgres"
            return "sqlite"
        if self.database_url:
            if "postgres" in self.database_url.lower():
                return "postgres"
        return "sqlite"

    @property
    def allowed_origin_list(self) -> list[str]:
        if not self.allowed_origins:
            return []
        return [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        backend_env = Path(__file__).resolve().parents[1] / ".env"
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            DotEnvSettingsSource(settings_cls, env_file=backend_env),
            file_secret_settings,
        )


settings = Settings()
