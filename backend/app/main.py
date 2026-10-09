from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import Base, engine
from app.db_migrate import ensure_sqlite_columns
from app.routers import admin, comments, events, ingest
from app.utils.media import ensure_upload_dirs

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="CMS de eventos ECA360",
    version="1.0.0",
)

# Dev-friendly CORS: * or lista explícita + localhost en cualquier puerto
_cors_origins = settings.cors_origin_list
_allow_all = settings.cors_allow_all
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _cors_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+" if not _allow_all else None,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables (Alembic también corre en entrypoint Docker)
Base.metadata.create_all(bind=engine)
ensure_sqlite_columns()
ensure_upload_dirs()

upload_path = Path(settings.upload_dir)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(events.router)
app.include_router(comments.router)
app.include_router(admin.router)
app.include_router(ingest.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}
