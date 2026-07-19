"""
Central configuration for the backend.
All values are loaded from environment variables (see .env.example),
so nothing sensitive is ever hardcoded in the source.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Gemini (Google AI Studio / Gemini Developer API)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"

    # App
    app_env: str = "development"
    frontend_origin: str = "http://localhost:3000"


settings = Settings()


def supabase_is_configured() -> bool:
    """True once real Supabase credentials have been provided."""
    return bool(settings.supabase_url) and bool(settings.supabase_service_role_key)
