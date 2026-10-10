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

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return origins or ["*"]

    @property
    def cors_allow_all(self) -> bool:
        return "*" in self.cors_origin_list


@lru_cache
def get_settings() -> Settings:
    return Settings()
