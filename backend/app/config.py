from pydantic_settings import BaseSettings, SettingsConfigDict


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
    stripe_price_starter: str = ""
    stripe_price_pro: str = ""
    stripe_price_team: str = ""

    # Brevo (optional — email notifications)
    brevo_api_key: str = ""

    # Anthropic (optional — Smart Alerts, Cost Autopilot)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Slack (optional — bot slash commands + OAuth)
    slack_signing_secret: str = ""
    slack_client_id: str = ""
    slack_client_secret: str = ""

    # App public URL (used for OAuth redirects)
    app_url: str = "https://api.agentshield.one"


settings = Settings()
