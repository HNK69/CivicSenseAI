"""
app/core/config.py
──────────────────
Single source of truth for all service settings.
Loaded once at import time from environment variables / .env file.
Every other module imports `get_settings()` or `settings` directly.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # silently ignore unknown env vars from teammates' .env
    )

    # ── Service identity ───────────────────────────────────────────────────────
    service_name: str = Field(default="civicsense-ai")
    service_version: str = Field(default="0.1.0")
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")

    # ── Ollama / Gemma ─────────────────────────────────────────────────────────
    ollama_host: str = Field(default="localhost")
    ollama_port: int = Field(default=11434)
    gemma_model: str = Field(default="gemma4:12b")
    gemma_timeout_seconds: int = Field(default=120)
    ollama_probe_timeout_seconds: int = Field(default=10)

    # ── Embeddings ─────────────────────────────────────────────────────────────
    embedding_model: str = Field(default="bge-m3:latest")
    embedding_dimension: int = Field(default=1024)

    # ── FAISS ─────────────────────────────────────────────────────────────────
    faiss_index_dir: Path = Field(default=Path("./data/faiss"))
    faiss_top_k: int = Field(default=10)

    # ── Cloudinary (credentials provided by Node teammate) ────────────────────
    cloudinary_cloud_name: str = Field(default="")
    cloudinary_api_key: str = Field(default="")
    cloudinary_api_secret: str = Field(default="")

    # ── Derived properties ────────────────────────────────────────────────────
    @property
    def ollama_base_url(self) -> str:
        return f"http://{self.ollama_host}:{self.ollama_port}"

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}, got '{v}'")
        return upper


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the cached Settings singleton. Use as a FastAPI dependency."""
    return Settings()


# Module-level singleton — importable directly where DI isn't needed.
settings: Settings = get_settings()
