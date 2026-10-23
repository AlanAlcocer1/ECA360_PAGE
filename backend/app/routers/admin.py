from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MediaFile
from app.schemas import LoginRequest, LoginResponse, MediaOut, SiteSettings, SiteSettingsUpdate
from app.services import site as site_service
from app.services.r2_migrate import get_migration_job, migration_preview, start_migration_job
from app.utils.auth import make_persistent_token, require_admin, verify_password
from app.utils.media import save_upload

router = APIRouter(tags=["admin"])


class MigrateR2Request(BaseModel):
    delete_local: bool = Field(False, description="Borrar del disco tras subir OK a R2")
    dry_run: bool = Field(False, description="Solo listar / simular sin escribir")


@router.post("/admin/login", response_model=LoginResponse)
def admin_login(payload: LoginRequest):
    if not verify_password(payload.password):
        return LoginResponse(success=False, token="", message="Contraseña incorrecta")
    token = make_persistent_token()
    return LoginResponse(success=True, token=token, message="Sesión iniciada")


@router.post("/admin/logout")
def admin_logout(_: str = Depends(require_admin)):
    return {"success": True}


@router.get("/admin/me")
def admin_me(_: str = Depends(require_admin)):
    return {"authenticated": True}


@router.get("/settings", response_model=SiteSettings)
def get_public_settings(db: Session = Depends(get_db)):
    """Public site branding — used by homepage, navbar, footer."""
    return site_service.get_site_settings(db)


@router.get("/admin/settings", response_model=SiteSettings)
def get_admin_settings(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    return site_service.get_site_settings(db)


@router.put("/admin/settings", response_model=SiteSettings)
def update_admin_settings(
    payload: SiteSettingsUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    return site_service.update_site_settings(db, payload)


@router.post("/upload", response_model=MediaOut)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    media = await save_upload(file, db)
    return media


@router.get("/media", response_model=list[MediaOut])
def list_media(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    return db.query(MediaFile).order_by(MediaFile.created_at.desc()).limit(200).all()


@router.get("/admin/migrate-r2/preview")
def migrate_r2_preview(_: str = Depends(require_admin)):
    """Resumen de archivos locales y estado R2 (antes de migrar)."""
    data = migration_preview()
    data["job"] = get_migration_job(since=0)
    # preview no necesita todos los eventos
    data["job"] = {
        k: v
        for k, v in data["job"].items()
        if k != "events"
    }
    return data


@router.get("/admin/migrate-r2/status")
def migrate_r2_status(
    since: int = Query(0, ge=0, description="Devolver eventos desde este índice"),
    _: str = Depends(require_admin),
):
    """Progreso del job en background (polling)."""
    return get_migration_job(since=since)


@router.post("/admin/migrate-r2/run")
def migrate_r2_run(payload: MigrateR2Request, _: str = Depends(require_admin)):
    """Arranca migración en background en el servidor (no depende del navegador)."""
    result = start_migration_job(
        apply=not payload.dry_run,
        delete_local=payload.delete_local,
    )
    if not result.get("started"):
        raise HTTPException(status_code=409, detail=result.get("error") or "Migración en curso")
    return result
