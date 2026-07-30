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
    gemma_timeout_seconds: int = Field(default=300)
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

    # ── Media download & processing (/analyze) ────────────────────────────────
    # Maximum bytes accepted per image download (default 10 MB).
    max_image_bytes: int = Field(default=10_485_760)
    # Images are resized so neither dimension exceeds this value before
    # being sent to Gemma, controlling token cost and latency.
    max_image_dimension: int = Field(default=1024)
    # Number of keyframes uniformly sampled from a video clip.
    analyze_max_frames: int = Field(default=4)
    # Timeout in seconds for a single Cloudinary media download.
    media_download_timeout_seconds: int = Field(default=30)

    # ── /analyze Gemma call ────────────────────────────────────────────────────
    # Context window for /analyze.  8192 tokens is sufficient for the actual
    # /analyze prompt (text + GPS + enum instructions + image descriptions).
    # WARNING: Do NOT set above 8192 on GPUs with <11GB VRAM — Gemma 4 12B
    # weights consume ~7.5GB, leaving ~1.5GB for a 8K KV cache.  Exceeding
    # available VRAM causes Ollama to offload KV cache to system RAM over PCIe,
    # making inference 10–50x slower and reliably exceeding any timeout.
    analyze_num_ctx: int = Field(default=8192)

    # ── /detect-duplicates ────────────────────────────────────────────────────
    duplicate_num_ctx: int = Field(default=8192)
    duplicate_similarity_threshold: float = Field(default=0.3)
    embedding_timeout_seconds: int = Field(default=30)
    faiss_persist_every_write: bool = Field(default=True)
    faiss_index_version: int = Field(default=1)

    # ── Google AI Studio (fallback provider) ──────────────────────────────────
    # Comma-separated API keys.  Empty string = fallback disabled (Ollama-only).
    # Never logged or exposed through any endpoint.
    google_ai_keys: str = Field(default="")
    # Google AI Studio model name — must be a Gemma model to stay 100% Gemma.
    google_ai_model: str = Field(default="gemma-4-12b-it")
    # Per-call read timeout for Google AI Studio requests.
    google_ai_timeout_seconds: int = Field(default=120)
    # How long (seconds) a rate-limited key sits in cooldown before retry.
    key_cooldown_seconds: float = Field(default=60.0)

    # ── Circuit breaker (guards Ollama) ───────────────────────────────────────
    # Number of consecutive Ollama failures before circuit opens.
    circuit_breaker_failure_threshold: int = Field(default=3)
    # Seconds the circuit stays open before transitioning to half-open.
    circuit_breaker_reset_timeout: float = Field(default=60.0)

    # ── Failover budget ────────────────────────────────────────────────────────
    # Wall-clock budget (seconds) for the entire failover chain per request.
    # Includes Ollama attempt + every Google key attempt.
    failover_budget_seconds: float = Field(default=120.0)

    # ── /verify-repair ────────────────────────────────────────────────────────
    verify_repair_num_ctx: int = Field(default=8192)
    verify_repair_max_images: int = Field(default=4)
    # Max dimension (px) images are resized to before diff and Gemma Vision.
    max_image_dimension: int = Field(default=1024)
    # Timeout (seconds) for downloading images from Cloudinary/external URLs.
    media_download_timeout_seconds: int = Field(default=30)

    # ── /copilot ──────────────────────────────────────────────────────────────
    copilot_num_ctx: int = Field(default=8192)
    copilot_max_tool_iterations: int = Field(default=3)

    # ── Derived properties ────────────────────────────────────────────────────
    @property
    def ollama_base_url(self) -> str:
        return f"http://{self.ollama_host}:{self.ollama_port}"

    @property
    def is_development(self) -> bool:
        return self.environment.lower() == "development"

    @property
    def google_ai_keys_list(self) -> list[str]:
        """Parse GOOGLE_AI_KEYS into a list of non-empty stripped strings."""
        if not self.google_ai_keys.strip():
            return []
        return [k.strip() for k in self.google_ai_keys.split(",") if k.strip()]

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
