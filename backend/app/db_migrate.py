"""Migraciones al arranque (Coolify / Docker).

Soporta BD restaurada sin tabla alembic_version:
aplica columnas faltantes (rating=5 por defecto) y estampa head.
"""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.config import get_settings
from app.database import engine
from app.utils.media import ensure_upload_dirs


def ensure_sqlite_columns() -> None:
    """Parches idempotentes para SQLite (create_all / BD vieja no agregan columnas)."""
    insp = inspect(engine)
    tables = set(insp.get_table_names())

    if "site_config" in tables:
        cols = {c["name"] for c in insp.get_columns("site_config")}
        if "public_site_url" not in cols:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "ALTER TABLE site_config ADD COLUMN public_site_url "
                        "VARCHAR(255) DEFAULT 'https://eca360.com.mx'"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE site_config SET public_site_url = 'https://eca360.com.mx' "
                        "WHERE public_site_url IS NULL OR public_site_url = ''"
                    )
                )

    if "comments" in tables:
        cols = {c["name"] for c in insp.get_columns("comments")}
        if "rating" not in cols:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE comments ADD COLUMN rating INTEGER NOT NULL DEFAULT 5")
                )
            print("[migrate] Columna comments.rating agregada (default 5)")


def _alembic_config() -> Config:
    # /app/alembic.ini en Docker; en local, relativo a backend/
    root = Path(__file__).resolve().parents[1]
    ini = root / "alembic.ini"
    if not ini.exists():
        ini = Path("/app/alembic.ini")
    cfg = Config(str(ini))
    cfg.set_main_option("sqlalchemy.url", get_settings().database_url)
    script = root / "alembic"
    if script.exists():
        cfg.set_main_option("script_location", str(script))
    return cfg


def run_migrations() -> None:
    """Ejecuta Alembic + parches SQLite. Seguro con BD de backup-vps."""
    ensure_upload_dirs()
    settings = get_settings()
    print(f"[migrate] DATABASE_URL={settings.database_url}")

    insp = inspect(engine)
    tables = set(insp.get_table_names())
    cfg = _alembic_config()

    if not tables:
        print("[migrate] BD vacía → alembic upgrade head")
        command.upgrade(cfg, "head")
    elif "alembic_version" not in tables:
        # BD de producción restaurada: no re-correr 001..003
        print("[migrate] BD existente sin alembic_version → ensure columns + stamp head")
        ensure_sqlite_columns()
        command.stamp(cfg, "head")
    else:
        print("[migrate] alembic upgrade head")
        command.upgrade(cfg, "head")
        ensure_sqlite_columns()

    print("[migrate] OK")


if __name__ == "__main__":
    run_migrations()
