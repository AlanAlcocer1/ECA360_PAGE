"""Migración de /uploads locales → Cloudflare R2 (eventos para UI/CLI)."""

from __future__ import annotations

import mimetypes
import threading
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from sqlalchemy.orm.attributes import flag_modified

from app.config import get_settings
from app.database import SessionLocal
from app.models import Event, EventBlock, MediaFile, SiteConfig
from app.utils.r2 import get_r2_client, r2_public_url, upload_file_path

UPLOAD_PREFIX = "/uploads/"
_migrate_lock = threading.Lock()


def migration_busy() -> bool:
    return _migrate_lock.locked()


def local_path_to_key(path: Path, upload_root: Path) -> str:
    return path.resolve().relative_to(upload_root.resolve()).as_posix()


def key_to_old_url(key: str) -> str:
    return f"{UPLOAD_PREFIX}{key.lstrip('/')}"


def guess_content_type(path: Path) -> str:
    ct, _ = mimetypes.guess_type(str(path))
    return ct or "application/octet-stream"


def collect_local_files(upload_root: Path) -> list[Path]:
    if not upload_root.is_dir():
        return []
    files: list[Path] = []
    for p in upload_root.rglob("*"):
        if p.is_file() and not p.name.startswith("."):
            files.append(p)
    return sorted(files)


def object_exists(key: str) -> bool:
    settings = get_settings()
    client = get_r2_client()
    try:
        client.head_object(Bucket=settings.r2_bucket, Key=key)
        return True
    except Exception:
        return False


def rewrite_string(value: str, mapping: dict[str, str], api_bases: list[str]) -> str:
    if not value or not isinstance(value, str):
        return value
    if value in mapping:
        return mapping[value]
    for base in api_bases:
        base = base.rstrip("/")
        if value.startswith(base + UPLOAD_PREFIX):
            rel = value[len(base) :]
            if rel in mapping:
                return mapping[rel]
        if value.startswith(base + "/uploads/"):
            rel = "/" + value[len(base) + 1 :]
            if rel in mapping:
                return mapping[rel]
    return value


def rewrite_json(obj: Any, mapping: dict[str, str], api_bases: list[str]) -> tuple[Any, bool]:
    changed = False
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            nv, c = rewrite_json(v, mapping, api_bases)
            out[k] = nv
            changed = changed or c
        return out, changed
    if isinstance(obj, list):
        out_list = []
        for v in obj:
            nv, c = rewrite_json(v, mapping, api_bases)
            out_list.append(nv)
            changed = changed or c
        return out_list, changed
    if isinstance(obj, str):
        nv = rewrite_string(obj, mapping, api_bases)
        return nv, nv != obj
    return obj, False


def build_api_bases(settings) -> list[str]:
    bases = []
    for b in (settings.api_url, "https://api.eca360.com.mx", "http://api.eca360.com.mx"):
        if b and b.rstrip("/") not in bases:
            bases.append(b.rstrip("/"))
    return bases


def migration_preview() -> dict[str, Any]:
    settings = get_settings()
    upload_root = Path(settings.upload_dir)
    files = collect_local_files(upload_root)
    total_bytes = sum(p.stat().st_size for p in files)
    samples = []
    for p in files[:15]:
        try:
            key = local_path_to_key(p, upload_root)
            samples.append(
                {
                    "key": key,
                    "size_mb": round(p.stat().st_size / 1e6, 2),
                    "old_url": key_to_old_url(key),
                }
            )
        except ValueError:
            continue
    return {
        "r2_configured": settings.r2_configured,
        "storage_backend": settings.storage_backend,
        "r2_bucket": settings.r2_bucket,
        "r2_public_base_url": settings.r2_public_base_url,
        "upload_dir": str(upload_root),
        "file_count": len(files),
        "total_mb": round(total_bytes / 1e6, 2),
        "busy": migration_busy(),
        "samples": samples,
    }


def iter_migration(*, apply: bool, delete_local: bool) -> Iterator[dict[str, Any]]:
    """Genera eventos de progreso para CLI o streaming HTTP."""
    if not _migrate_lock.acquire(blocking=False):
        yield {"type": "error", "message": "Ya hay una migración en curso."}
        return

    try:
        settings = get_settings()
        if apply and not settings.r2_configured:
            yield {
                "type": "error",
                "message": "R2 no configurado (STORAGE_BACKEND=r2 + keys + R2_PUBLIC_BASE_URL).",
            }
            return

        upload_root = Path(settings.upload_dir)
        files = collect_local_files(upload_root)
        yield {
            "type": "start",
            "apply": apply,
            "delete_local": delete_local and apply,
            "file_count": len(files),
            "upload_dir": str(upload_root),
            "public_base": settings.r2_public_base_url,
            "bucket": settings.r2_bucket,
        }

        if not files:
            yield {"type": "done", "ok": True, "message": "No hay archivos locales que migrar.", "stats": {}}
            return

        mapping: dict[str, str] = {}
        uploaded = skipped = deleted = db_updates = 0
        errors: list[str] = []

        for i, path in enumerate(files, start=1):
            try:
                key = local_path_to_key(path, upload_root)
            except ValueError as exc:
                msg = f"fuera de upload_dir: {path}"
                errors.append(msg)
                yield {"type": "file_error", "index": i, "total": len(files), "path": str(path), "message": msg}
                continue

            old_url = key_to_old_url(key)
            try:
                new_url = r2_public_url(key)
            except Exception as exc:
                yield {"type": "error", "message": str(exc)}
                return

            mapping[old_url] = new_url
            size_mb = round(path.stat().st_size / 1e6, 2)

            if not apply:
                yield {
                    "type": "file",
                    "index": i,
                    "total": len(files),
                    "action": "dry",
                    "key": key,
                    "old_url": old_url,
                    "new_url": new_url,
                    "size_mb": size_mb,
                }
                continue

            try:
                if object_exists(key):
                    skipped += 1
                    yield {
                        "type": "file",
                        "index": i,
                        "total": len(files),
                        "action": "skip",
                        "key": key,
                        "old_url": old_url,
                        "new_url": new_url,
                        "size_mb": size_mb,
                    }
                else:
                    ct = guess_content_type(path)
                    upload_file_path(key=key, path=str(path), content_type=ct)
                    uploaded += 1
                    yield {
                        "type": "file",
                        "index": i,
                        "total": len(files),
                        "action": "uploaded",
                        "key": key,
                        "old_url": old_url,
                        "new_url": new_url,
                        "size_mb": size_mb,
                    }
            except Exception as exc:
                msg = f"{key}: {exc}"
                errors.append(msg)
                yield {
                    "type": "file_error",
                    "index": i,
                    "total": len(files),
                    "key": key,
                    "message": str(exc),
                }

        yield {
            "type": "upload_summary",
            "uploaded": uploaded,
            "skipped": skipped,
            "errors": len(errors),
            "mapping": len(mapping),
        }

        if not mapping:
            yield {"type": "done", "ok": False, "message": "Nada que migrar.", "stats": {"errors": len(errors)}}
            return

        api_bases = build_api_bases(settings)
        db = SessionLocal()
        try:
            for row in db.query(MediaFile).all():
                changed = False
                nu = rewrite_string(row.url or "", mapping, api_bases)
                if nu != (row.url or ""):
                    row.url = nu
                    changed = True
                if row.thumbnail_url:
                    nt = rewrite_string(row.thumbnail_url, mapping, api_bases)
                    if nt != row.thumbnail_url:
                        row.thumbnail_url = nt
                        changed = True
                if changed:
                    db_updates += 1

            for ev in db.query(Event).all():
                changed = False
                if ev.cover_image:
                    n = rewrite_string(ev.cover_image, mapping, api_bases)
                    if n != ev.cover_image:
                        ev.cover_image = n
                        changed = True
                if ev.og_image:
                    n = rewrite_string(ev.og_image, mapping, api_bases)
                    if n != ev.og_image:
                        ev.og_image = n
                        changed = True
                if changed:
                    db_updates += 1

            for sc in db.query(SiteConfig).all():
                changed = False
                if sc.logo_url:
                    n = rewrite_string(sc.logo_url, mapping, api_bases)
                    if n != sc.logo_url:
                        sc.logo_url = n
                        changed = True
                if sc.favicon_url:
                    n = rewrite_string(sc.favicon_url, mapping, api_bases)
                    if n != sc.favicon_url:
                        sc.favicon_url = n
                        changed = True
                if changed:
                    db_updates += 1

            for block in db.query(EventBlock).all():
                content, c1 = rewrite_json(block.content or {}, mapping, api_bases)
                settings_json, c2 = rewrite_json(block.settings or {}, mapping, api_bases)
                if c1 or c2:
                    block.content = content
                    block.settings = settings_json
                    flag_modified(block, "content")
                    flag_modified(block, "settings")
                    db_updates += 1

            if apply:
                db.commit()
                yield {"type": "db", "action": "committed", "rows": db_updates}
            else:
                db.rollback()
                yield {"type": "db", "action": "dry", "rows": db_updates}
        finally:
            db.close()

        if apply and delete_local:
            if errors:
                yield {
                    "type": "delete_skipped",
                    "message": "No se borró disco: hubo errores de subida.",
                    "errors": len(errors),
                }
            else:
                for i, path in enumerate(files, start=1):
                    try:
                        key = local_path_to_key(path, upload_root)
                        if object_exists(key):
                            path.unlink(missing_ok=True)
                            deleted += 1
                            yield {
                                "type": "delete",
                                "index": i,
                                "total": len(files),
                                "key": key,
                                "action": "deleted",
                            }
                        else:
                            yield {
                                "type": "delete",
                                "index": i,
                                "total": len(files),
                                "key": key,
                                "action": "missing_on_r2",
                            }
                    except Exception as exc:
                        errors.append(f"delete {path}: {exc}")
                        yield {
                            "type": "delete_error",
                            "path": str(path),
                            "message": str(exc),
                        }
                for d in sorted(upload_root.rglob("*"), reverse=True):
                    if d.is_dir():
                        try:
                            d.rmdir()
                        except OSError:
                            pass
                yield {"type": "delete_summary", "deleted": deleted}

        ok = len(errors) == 0
        yield {
            "type": "done",
            "ok": ok,
            "message": "Migración completada." if ok else "Migración terminó con errores.",
            "stats": {
                "uploaded": uploaded,
                "skipped": skipped,
                "deleted": deleted,
                "db_updates": db_updates,
                "errors": len(errors),
                "error_samples": errors[:20],
            },
        }
    finally:
        _migrate_lock.release()
