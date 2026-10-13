"""Recepción abierta de fotos/videos para carruseles (sin auth).

URL: POST /ingest/{code}
Campo: file (uno o varios)

Si en el mismo envío vienen video + miniatura (p. ej. processed.mp4 + thumb.jpg),
la foto se usa como poster del video y no se agrega como item suelto.
"""

from __future__ import annotations

import re
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.models import EventBlock
from app.utils.media import IMAGE_EXTS, VIDEO_EXTS, save_upload

router = APIRouter(tags=["ingest"])

CODE_RE = re.compile(r"^[a-z0-9][a-z0-9\-_]{1,62}$")
THUMB_NAME_RE = re.compile(
    r"^(thumb|thumbnail|poster|preview|cover)([-_.].*)?$",
    re.IGNORECASE,
)


def normalize_code(code: str) -> str:
    return (code or "").strip().lower()


def find_carousel_by_code(db: Session, code: str) -> EventBlock:
    code = normalize_code(code)
    if not CODE_RE.match(code):
        raise HTTPException(400, "Código inválido. Usa letras, números, guiones (ej: boda-ana).")

    blocks = db.query(EventBlock).filter(EventBlock.type == "carousel").all()
    for block in blocks:
        settings = block.settings or {}
        content = block.content or {}
        block_code = normalize_code(str(settings.get("ingest_code") or content.get("ingest_code") or ""))
        if block_code and block_code == code:
            return block
    raise HTTPException(404, f"No hay carrusel con código '{code}'. Configúralo en el editor del evento.")


def _stem(name: str) -> str:
    return Path(name or "").stem.lower()


def _is_thumb_name(name: str) -> bool:
    stem = _stem(name)
    return bool(THUMB_NAME_RE.match(stem))


def _guess_kind(filename: str, media_type: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if media_type == "video" or ext in VIDEO_EXTS:
        return "video"
    if media_type == "image" or ext in IMAGE_EXTS:
        return "image"
    return media_type


def pair_videos_with_posters(saved: list[dict]) -> tuple[list[dict], list[dict]]:
    """Devuelve (entries_para_carrusel, meta_added).

    Empareja videos con imágenes thumbnail del mismo lote.
    """
    videos = [s for s in saved if s["kind"] == "video"]
    images = [s for s in saved if s["kind"] == "image"]
    used_image_ids: set[int] = set()
    entries: list[dict] = []
    added: list[dict] = []

    for video in videos:
        poster = None
        vstem = _stem(video["original_name"])

        # 1) Misma base: processed.mp4 + processed.jpg
        for img in images:
            if img["id"] in used_image_ids:
                continue
            if _stem(img["original_name"]) == vstem:
                poster = img
                break

        # 2) Nombre tipo thumb / thumbnail / poster
        if poster is None:
            for img in images:
                if img["id"] in used_image_ids:
                    continue
                if _is_thumb_name(img["original_name"]):
                    poster = img
                    break

        # 3) Un solo video + una sola imagen en el lote
        if poster is None and len(videos) == 1 and len(images) == 1:
            only = images[0]
            if only["id"] not in used_image_ids:
                poster = only

        if poster is not None:
            used_image_ids.add(poster["id"])

        entry = {
            "type": "video",
            "url": video["url"],
            "alt": video["original_name"] or "",
        }
        if poster is not None:
            entry["poster"] = poster["url"]
        elif video.get("thumbnail_url"):
            entry["poster"] = video["thumbnail_url"]

        entries.append(entry)
        meta = {"url": video["url"], "type": "video", "id": video["id"]}
        if poster is not None:
            meta["poster"] = poster["url"]
            meta["poster_from"] = poster["original_name"]
        added.append(meta)

    # Imágenes no usadas como poster → items normales
    for img in images:
        if img["id"] in used_image_ids:
            continue
        entries.append(
            {
                "type": "image",
                "url": img["url"],
                "alt": img["original_name"] or "",
            }
        )
        added.append({"url": img["url"], "type": "image", "id": img["id"]})

    return entries, added


def attach_orphan_thumb_to_last_video(items: list[dict], image_url: str, image_alt: str) -> bool:
    """Si llega solo un thumb y el último item es video sin poster, lo adjunta."""
    if not items or not _is_thumb_name(image_alt):
        return False
    last = items[-1]
    if last.get("type") != "video" or last.get("poster"):
        return False
    last["poster"] = image_url
    return True


@router.get("/ingest/{code}")
def ingest_info(code: str, db: Session = Depends(get_db)):
    block = find_carousel_by_code(db, code)
    items = (block.content or {}).get("items") or []
    return {
        "ok": True,
        "code": normalize_code(code),
        "event_id": block.event_id,
        "block_id": block.id,
        "items_count": len(items),
        "hint": (
            "POST multipart campo 'file' (fotos o videos). "
            "Si mandas video + thumb.jpg juntos, el thumb queda como poster del video."
        ),
    }


@router.post("/ingest/{code}")
async def ingest_files(
    code: str,
    file: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """Recibe fotos/videos; empareja thumbnails con videos del mismo envío."""
    block = find_carousel_by_code(db, code)

    uploads = [f for f in (file or []) if f and f.filename]
    if not uploads:
        raise HTTPException(400, "Envía al menos un archivo en el campo 'file'.")

    content = dict(block.content or {})
    items = list(content.get("items") or [])

    saved: list[dict] = []
    for upload in uploads:
        media = await save_upload(upload, db)
        kind = _guess_kind(media.original_name or upload.filename or "", media.media_type)
        saved.append(
            {
                "id": media.id,
                "kind": kind,
                "url": media.url,
                "thumbnail_url": media.thumbnail_url,
                "original_name": media.original_name or upload.filename or "",
            }
        )

    # Caso: solo llegó un thumb después del video (otro request)
    if len(saved) == 1 and saved[0]["kind"] == "image":
        img = saved[0]
        if attach_orphan_thumb_to_last_video(items, img["url"], img["original_name"]):
            content["items"] = items
            block.content = content
            flag_modified(block, "content")
            db.add(block)
            db.commit()
            return {
                "ok": True,
                "code": normalize_code(code),
                "added": 0,
                "attached_poster": True,
                "items_count": len(items),
                "files": [
                    {
                        "url": items[-1]["url"],
                        "type": "video",
                        "poster": img["url"],
                        "poster_from": img["original_name"],
                    }
                ],
            }

    new_entries, added = pair_videos_with_posters(saved)
    items.extend(new_entries)

    content["items"] = items
    block.content = content
    flag_modified(block, "content")
    db.add(block)
    db.commit()

    return {
        "ok": True,
        "code": normalize_code(code),
        "added": len(added),
        "items_count": len(items),
        "files": added,
    }
