"""Environment-driven settings (no extra deps — dotenv + os.environ)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load service/.env by ABSOLUTE path, derived from this file's location.
#
# A bare load_dotenv() searches upward from the CURRENT WORKING DIRECTORY, so the config
# depended on where the process was launched from: `cd service && uvicorn ...` found
# service/.env, but launching from the repo root used to find the root .env instead (a
# near-duplicate that has since been removed). This mirrors how backend/src/config/env.js
# resolves its own .env, so dev, tests and containers all read the same file.
#
# override=False: real environment variables win over the file, which is what lets
# Docker/Kubernetes inject config without the image's .env shadowing it.
_SERVICE_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_SERVICE_ROOT / ".env", override=False)


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _csv(name: str, default: str) -> list[str]:
    return [s.strip() for s in os.getenv(name, default).split(",") if s.strip()]


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "4100"))
    log_level: str = os.getenv("LOG_LEVEL", "info")
    cors_origins: list[str] = field(
        default_factory=lambda: _csv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    )

    # identity
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-dev-only-not-for-production")
    jwt_alg: str = os.getenv("JWT_ALG", "HS256")
    auth_required: bool = _bool("AUTH_REQUIRED", False)
    demo_user_id: str = os.getenv("DEMO_USER_ID", "idn_citizen_1")

    # llm (OpenAI)
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY") or None
    llm_model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "1024"))

    # tools
    tavily_api_key: str | None = os.getenv("TAVILY_API_KEY") or None

    # platform backend API — the agent reads LIVE citizen data (profile, applications)
    # from the data owner using the citizen's own token, instead of static mock data.
    backend_api_url: str = os.getenv("BACKEND_API_URL", "http://127.0.0.1:4000/api/v1")
    backend_timeout: float = float(os.getenv("BACKEND_TIMEOUT", "6"))

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key)


settings = Settings()
