from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    app_env: str = "development"
    app_debug: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Feature flags
    rate_limit_enabled: bool = True

    # Supabase (required)
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Redis (required)
    redis_url: str

    # Sentry (optional)
    sentry_dsn: str = ""

    # Stripe (optional)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # Brevo (optional — email notifications)
    brevo_api_key: str = ""

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v


settings = Settings()
