#!/usr/bin/env python3
"""Migra archivos locales /uploads → Cloudflare R2 y reescribe URLs en la BD.

Uso (dentro del contenedor API, con vars R2_* cargadas):

  # Solo informe (no sube ni borra)
  python scripts/migrate_uploads_to_r2.py

  # Sube a R2 + actualiza BD (no borra disco)
  python scripts/migrate_uploads_to_r2.py --apply

  # Sube, actualiza BD y elimina del disco los que migraron OK
  python scripts/migrate_uploads_to_r2.py --apply --delete-local

En Coolify (SSH al VPS):
  docker exec -it CONTAINER sh -c 'cd /app && python scripts/migrate_uploads_to_r2.py --apply --delete-local'
"""

from __future__ import annotations

import argparse
import mimetypes
import sys
from pathlib import Path
from typing import Any

# Asegura imports de app/
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm.attributes import flag_modified  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Event, EventBlock, MediaFile, SiteConfig  # noqa: E402
from app.utils.r2 import get_r2_client, r2_public_url, upload_file_path  # noqa: E402

UPLOAD_PREFIX = "/uploads/"


def local_path_to_key(path: Path, upload_root: Path) -> str:
    rel = path.resolve().relative_to(upload_root.resolve()).as_posix()
    return rel


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
    # https://api.../uploads/foo → /uploads/foo
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
    # ya es R2 u otra cosa
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


def migrate(apply: bool, delete_local: bool) -> int:
    settings = get_settings()
    get_settings.cache_clear()
    settings = get_settings()

    if not settings.r2_configured and apply:
        # allow dry-run without full r2 if public url missing? require for apply
        print("ERROR: R2 no configurado (STORAGE_BACKEND=r2 + keys + R2_PUBLIC_BASE_URL + bucket).")
        return 1

    upload_root = Path(settings.upload_dir)
    files = collect_local_files(upload_root)
    print(f"UPLOAD_DIR={upload_root}  archivos locales={len(files)}")
    print(f"R2_BUCKET={settings.r2_bucket}  PUBLIC={settings.r2_public_base_url}")
    print(f"modo={'APPLY' if apply else 'DRY-RUN'}  delete_local={delete_local and apply}")

    mapping: dict[str, str] = {}
    uploaded = 0
    skipped = 0
    errors: list[str] = []

    for path in files:
        try:
            key = local_path_to_key(path, upload_root)
        except ValueError:
            errors.append(f"fuera de upload_dir: {path}")
            continue
        old_url = key_to_old_url(key)
        new_url = r2_public_url(key)
        mapping[old_url] = new_url

        if not apply:
            print(f"  [dry] {old_url} → {new_url}")
            continue

        try:
            if object_exists(key):
                print(f"  [skip exists] {key}")
                skipped += 1
            else:
                ct = guess_content_type(path)
                upload_file_path(key=key, path=str(path), content_type=ct)
                print(f"  [ok] {key} ({path.stat().st_size / 1e6:.2f} MB)")
                uploaded += 1
        except Exception as exc:
            errors.append(f"{key}: {exc}")
            print(f"  [ERR] {key}: {exc}")

    print(f"\nSubida: ok={uploaded} skip={skipped} errores={len(errors)} mapping={len(mapping)}")

    if not mapping:
        print("Nada que migrar.")
        return 1 if errors else 0

    api_bases = build_api_bases(settings)
    db = SessionLocal()
    db_updates = 0
    try:
        # media_files
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

        # events
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

        # site_config
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

        # event_blocks JSON
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
            print(f"BD actualizada: {db_updates} filas/bloques tocados")
        else:
            db.rollback()
            print(f"[dry] BD tocaría ~{db_updates} filas/bloques (no commit)")
    finally:
        db.close()

    deleted = 0
    if apply and delete_local and not errors:
        for path in files:
            try:
                key = local_path_to_key(path, upload_root)
                # solo borrar si está en R2
                if object_exists(key):
                    path.unlink(missing_ok=True)
                    deleted += 1
            except Exception as exc:
                errors.append(f"delete {path}: {exc}")
        # limpia dirs vacíos
        for d in sorted(upload_root.rglob("*"), reverse=True):
            if d.is_dir():
                try:
                    d.rmdir()
                except OSError:
                    pass
        print(f"Eliminados del disco: {deleted}")
    elif apply and delete_local and errors:
        print("NO se borró disco: hubo errores de subida. Revisa y reintenta.")

    if errors:
        print("\nErrores:")
        for e in errors[:30]:
            print(" -", e)
        if len(errors) > 30:
            print(f" ... +{len(errors) - 30} más")
        return 1

    print("\nListo.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrar /uploads locales a Cloudflare R2")
    parser.add_argument("--apply", action="store_true", help="Sube a R2 y actualiza la BD")
    parser.add_argument(
        "--delete-local",
        action="store_true",
        help="Tras migrar OK, borra los archivos locales (requiere --apply)",
    )
    args = parser.parse_args()
    if args.delete_local and not args.apply:
        print("ERROR: --delete-local requiere --apply")
        sys.exit(2)
    raise SystemExit(migrate(apply=args.apply, delete_local=args.delete_local))


if __name__ == "__main__":
    main()
