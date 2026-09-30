from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "changeme"
    DB_NAME: str = "at_recouvrement"

    DATABASE_URL: str | None = None
    CORS_ORIGINS: str = "http://localhost:5173"
    ENV: str = "development"

    # --- Rappels de versement (clients ENGAGÉS sans versement) ---
    REMINDER_DELAY_DAYS: int = 30              # « un mois » sans versement
    REMINDER_CHECK_INTERVAL_HOURS: float = 24  # fréquence du contrôle automatique
    REMINDER_SCHEDULER_ENABLED: bool = True    # false = pas de contrôle auto (POST /rappels/verifier reste dispo)
    REMINDER_COUNT_PENDING: bool = True        # un règlement 'en_attente' compte comme « a versé »

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
