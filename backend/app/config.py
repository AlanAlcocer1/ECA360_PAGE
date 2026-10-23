from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./eca360.db"
    admin_password: str = "eca360admin"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "https://eca360-page.pages.dev,"
        "https://eca360.com.mx,https://www.eca360.com.mx"
    )
    upload_dir: str = "uploads"
    max_image_size_mb: int = 10
    max_video_size_mb: int = 200
    app_name: str = "ECA360 Eventos"
    app_url: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"

    # Storage: local (disco /uploads) | r2 (Cloudflare R2)
    storage_backend: str = "local"
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = "eca360-media"
    r2_endpoint: str = ""
    r2_public_base_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return origins or ["*"]

    @property
    def cors_allow_all(self) -> bool:
        return "*" in self.cors_origin_list

    @property
    def r2_configured(self) -> bool:
        return bool(
            self.storage_backend == "r2"
            and self.r2_access_key_id
            and self.r2_secret_access_key
            and self.r2_endpoint
            and self.r2_public_base_url
            and self.r2_bucket
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

