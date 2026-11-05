"""Settings come from environment variables (see README)."""
import os
from dataclasses import dataclass
from pathlib import Path

# Always place SQLite database in Backend/ams_backend/ams.db regardless of terminal launch location
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB_URL = f"sqlite:///{(_PROJECT_ROOT / 'ams.db').as_posix()}"


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", _DEFAULT_DB_URL)
    secret_key: str = os.getenv("SECRET_KEY", "ams-dev-secret-key-minimum-32-bytes-long-for-production-safety")
    token_minutes: int = int(os.getenv("TOKEN_MINUTES", "720"))
    cors_origins: tuple = tuple(os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","))
    business_name: str = os.getenv("BUSINESS_NAME", "L&N Apartments")
    receipt_place: str = os.getenv("RECEIPT_PLACE", "Buea")
    timezone: str = os.getenv("TIMEZONE", "Africa/Douala")


settings = Settings()
