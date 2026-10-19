"""Environment loading. Loads ../.env (repo root) so Langfuse and provider SDKs see the keys."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATA_DIR = Path(os.getenv("ARENA_DATA_DIR", Path(__file__).resolve().parents[1] / "data" / "sessions"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]


def env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return value if value else default
