from __future__ import annotations

import mimetypes
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile
from PIL import Image
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import MediaFile

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".avi"}


def ensure_upload_dirs() -> dict[str, Path]:
    settings = get_settings()
    base = Path(settings.upload_dir)
    dirs = {
        "images": base / "images",
        "videos": base / "videos",
        "thumbnails": base / "thumbnails",
    }
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)
    return dirs


def _unique_name(original: str, *, force_ext: str | None = None) -> str:
    ext = force_ext if force_ext else (Path(original).suffix.lower() or ".bin")
    if not ext.startswith("."):
        ext = f".{ext}"
    return f"{uuid.uuid4().hex}{ext}"


def compress_to_webp(
    src: Path,
    dest: Path,
    max_width: int = 1920,
    quality: int = 85,
) -> tuple[int, int]:
    """Re-encode a WebP (alta calidad) para servir en web con menos peso."""
    with Image.open(src) as img:
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        img = img.convert("RGBA" if has_alpha else "RGB")
        w, h = img.size
        if w > max_width:
            ratio = max_width / w
            img = img.resize((max_width, int(h * ratio)), Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, format="WEBP", quality=quality, method=6)
        return img.size


def make_thumbnail_webp(src: Path, dest: Path, size: tuple[int, int] = (400, 400), quality: int = 80) -> None:
    with Image.open(src) as img:
        has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
        img = img.convert("RGBA" if has_alpha else "RGB")
        img.thumbnail(size, Image.Resampling.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest, format="WEBP", quality=quality, method=6)


def _guess_content_type(path: Path, fallback: str) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or fallback


def _save_local(
    *,
    data: bytes,
    filename: str,
    is_image: bool,
    content_type: str,
    keep_gif: bool,
) -> tuple[str, Optional[str], Optional[int], Optional[int], int, str]:
    """Devuelve url, thumbnail_url, w, h, size, stored_mime."""
    settings = get_settings()
    dirs = ensure_upload_dirs()
    folder = dirs["images"] if is_image else dirs["videos"]
    dest = folder / filename
    dest.write_bytes(data)
    size = len(data)
    stored_mime = content_type

    width = height = None
    thumbnail_url: Optional[str] = None
    url = f"/uploads/{'images' if is_image else 'videos'}/{filename}"

    if is_image and not keep_gif:
        try:
            webp_path = folder / filename  # ya .webp
            raw_tmp = folder / f"_raw_{filename}"
            dest.rename(raw_tmp)
            width, height = compress_to_webp(raw_tmp, webp_path, quality=settings.webp_quality)
            raw_tmp.unlink(missing_ok=True)
            dest = webp_path
            size = dest.stat().st_size
            stored_mime = "image/webp"

            thumb_name = f"t_{Path(filename).stem}.webp"
            thumb_path = dirs["thumbnails"] / thumb_name
            make_thumbnail_webp(dest, thumb_path)
            thumbnail_url = f"/uploads/thumbnails/{thumb_name}"
        except Exception:
            pass
    elif is_image and keep_gif:
        try:
            with Image.open(dest) as img:
                width, height = img.size
            thumb_name = f"t_{Path(filename).stem}.webp"
            thumb_path = dirs["thumbnails"] / thumb_name
            make_thumbnail_webp(dest, thumb_path)
            thumbnail_url = f"/uploads/thumbnails/{thumb_name}"
        except Exception:
            pass

    return url, thumbnail_url, width, height, size, stored_mime


def _save_r2(
    *,
    data: bytes,
    filename: str,
    is_image: bool,
    content_type: str,
    keep_gif: bool,
) -> tuple[str, Optional[str], Optional[int], Optional[int], int, str]:
    from app.utils.r2 import upload_bytes, upload_file_path

    settings = get_settings()
    width = height = None
    thumbnail_url: Optional[str] = None
    folder = "images" if is_image else "videos"
    key = f"{folder}/{filename}"
    size = len(data)
    stored_mime = content_type

    with tempfile.TemporaryDirectory(prefix="eca360-r2-") as tmp:
        tmp_dir = Path(tmp)
        dest = tmp_dir / filename
        dest.write_bytes(data)

        if is_image and not keep_gif:
            try:
                webp_path = tmp_dir / filename
                raw_tmp = tmp_dir / f"_raw_{filename}"
                dest.rename(raw_tmp)
                width, height = compress_to_webp(raw_tmp, webp_path, quality=settings.webp_quality)
                dest = webp_path
                size = dest.stat().st_size
                stored_mime = "image/webp"

                thumb_name = f"t_{Path(filename).stem}.webp"
                thumb_path = tmp_dir / thumb_name
                make_thumbnail_webp(dest, thumb_path)
                thumbnail_url = upload_file_path(
                    key=f"thumbnails/{thumb_name}",
                    path=str(thumb_path),
                    content_type="image/webp",
                )
            except Exception:
                pass

            url = upload_file_path(key=key, path=str(dest), content_type=stored_mime)
        elif is_image and keep_gif:
            try:
                with Image.open(dest) as img:
                    width, height = img.size
                thumb_name = f"t_{Path(filename).stem}.webp"
                thumb_path = tmp_dir / thumb_name
                make_thumbnail_webp(dest, thumb_path)
                thumbnail_url = upload_file_path(
                    key=f"thumbnails/{thumb_name}",
                    path=str(thumb_path),
                    content_type="image/webp",
                )
            except Exception:
                pass
            url = upload_file_path(key=key, path=str(dest), content_type="image/gif")
            stored_mime = "image/gif"
        else:
            ct = content_type if content_type in VIDEO_TYPES else _guess_content_type(dest, "video/mp4")
            url = upload_bytes(key=key, data=data, content_type=ct)
            size = len(data)
            stored_mime = ct

    return url, thumbnail_url, width, height, size, stored_mime


async def save_upload(file: UploadFile, db: Session) -> MediaFile:
    settings = get_settings()

    content_type = file.content_type or "application/octet-stream"
    original = file.filename or "file"
    ext = Path(original).suffix.lower()

    is_image = content_type in IMAGE_TYPES or ext in IMAGE_EXTS
    is_video = content_type in VIDEO_TYPES or ext in VIDEO_EXTS

    if not is_image and not is_video:
        raise HTTPException(400, "Tipo de archivo no permitido. Usa imágenes o videos (MP4, MOV, WebM).")

    data = await file.read()
    size = len(data)
    max_mb = settings.max_image_size_mb if is_image else settings.max_video_size_mb
    if size > max_mb * 1024 * 1024:
        raise HTTPException(400, f"Archivo demasiado grande. Máximo {max_mb} MB.")

    keep_gif = is_image and (ext == ".gif" or content_type == "image/gif")
    if is_image and not keep_gif:
        filename = _unique_name(original, force_ext=".webp")
    else:
        filename = _unique_name(original)

    media_type = "image" if is_image else "video"

    try:
        if settings.storage_backend == "r2":
            if not settings.r2_configured:
                raise HTTPException(
                    500,
                    "STORAGE_BACKEND=r2 pero faltan R2_ENDPOINT / keys / R2_PUBLIC_BASE_URL / R2_BUCKET",
                )
            url, thumbnail_url, width, height, size, stored_mime = _save_r2(
                data=data,
                filename=filename,
                is_image=is_image,
                content_type=content_type,
                keep_gif=keep_gif,
            )
        else:
            url, thumbnail_url, width, height, size, stored_mime = _save_local(
                data=data,
                filename=filename,
                is_image=is_image,
                content_type=content_type,
                keep_gif=keep_gif,
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Error al guardar archivo: {exc}") from exc

    media = MediaFile(
        filename=filename,
        original_name=original,
        media_type=media_type,
        mime_type=stored_mime,
        url=url,
        thumbnail_url=thumbnail_url,
        size_bytes=size,
        width=width,
        height=height,
        duration=None,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media
