"""Descarga de media.

- Imágenes: WebP → PNG bajo demanda (/download)
- Cualquier archivo permitido (video/R2): proxy con Content-Disposition (/download/file)
  para evitar CORS en el navegador del celular.
"""

from __future__ import annotations

import io
import mimetypes
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from PIL import Image

from app.config import get_settings

router = APIRouter(tags=["download"])


def _allowed_media_url(url: str) -> bool:
    settings = get_settings()
    u = (url or "").strip()
    if not u:
        return False
    if u.startswith("/uploads/"):
        return True
    if u.startswith("uploads/"):
        return True
    parsed = urlparse(u)
    if parsed.scheme not in ("http", "https"):
        return False
    allowed_hosts: set[str] = set()
    for base in (settings.api_url, settings.r2_public_base_url):
        if not base:
            continue
        host = urlparse(base if "://" in base else f"https://{base}").netloc.lower()
        if host:
            allowed_hosts.add(host)
    # api.eca360.com.mx y pages proxy suelen pedir al API
    host = parsed.netloc.lower()
    if host in allowed_hosts:
        return True
    # Permitir mismo host del API aunque api_url tenga path
    if host.endswith("eca360.com.mx") or host.endswith("r2.dev"):
        return True
    return False


def _load_image_bytes(url: str) -> bytes:
    settings = get_settings()
    u = url.strip()
    if u.startswith("uploads/"):
        u = f"/{u}"

    if u.startswith("/uploads/"):
        rel = u[len("/uploads/") :]
        path = Path(settings.upload_dir) / rel
        if not path.is_file():
            raise HTTPException(404, "Archivo no encontrado")
        # Evitar path traversal
        try:
            path.resolve().relative_to(Path(settings.upload_dir).resolve())
        except ValueError as exc:
            raise HTTPException(400, "URL no permitida") from exc
        return path.read_bytes()

    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            res = client.get(u)
            res.raise_for_status()
            return res.content
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"No se pudo obtener la imagen: {exc}") from exc


@router.get("/download")
def download_image_as_png(
    url: str = Query(..., description="URL o path /uploads/... de la imagen"),
    filename: str | None = Query(None, description="Nombre sugerido sin extensión"),
):
    """Convierte la imagen (p. ej. WebP) a PNG para descarga en el dispositivo."""
    if not _allowed_media_url(url):
        raise HTTPException(400, "URL de media no permitida")

    raw = _load_image_bytes(url)
    try:
        with Image.open(io.BytesIO(raw)) as img:
            # PNG con alpha si aplica
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                out_img = img.convert("RGBA")
            else:
                out_img = img.convert("RGB")
            buf = io.BytesIO()
            out_img.save(buf, format="PNG", optimize=True)
            data = buf.getvalue()
    except Exception as exc:
        raise HTTPException(400, f"No se pudo convertir a PNG: {exc}") from exc

    base = (filename or Path(urlparse(url).path).stem or "foto").strip()
    base = "".join(c for c in base if c.isalnum() or c in ("-", "_", ".", " "))[:80] or "foto"
    if base.lower().endswith(".png"):
        download_name = base
    else:
        download_name = f"{Path(base).stem}.png"

    return Response(
        content=data,
        media_type="image/png",
        headers={
            "Content-Disposition": f'attachment; filename="{download_name}"',
            "Cache-Control": "private, max-age=3600",
        },
    )


def _safe_filename(name: str | None, fallback: str, ext: str) -> str:
    base = (name or fallback or "archivo").strip()
    base = "".join(c for c in base if c.isalnum() or c in ("-", "_", ".", " "))[:80] or fallback
    stem = Path(base).stem or fallback
    if not ext.startswith("."):
        ext = f".{ext}"
    return f"{stem}{ext}"


@router.get("/download/file")
def download_file_proxy(
    url: str = Query(..., description="URL o path /uploads/..."),
    filename: str | None = Query(None, description="Nombre sugerido con o sin extensión"),
):
    """Sirve el archivo original (p. ej. video en R2) con attachment — mismo origen API."""
    if not _allowed_media_url(url):
        raise HTTPException(400, "URL de media no permitida")

    settings = get_settings()
    u = url.strip()
    if u.startswith("uploads/"):
        u = f"/{u}"

    # Local
    if u.startswith("/uploads/"):
        rel = u[len("/uploads/") :]
        path = Path(settings.upload_dir) / rel
        try:
            path.resolve().relative_to(Path(settings.upload_dir).resolve())
        except ValueError as exc:
            raise HTTPException(400, "URL no permitida") from exc
        if not path.is_file():
            raise HTTPException(404, "Archivo no encontrado")
        guessed, _ = mimetypes.guess_type(str(path))
        media_type = guessed or "application/octet-stream"
        ext = path.suffix or ".bin"
        download_name = _safe_filename(filename, path.stem, ext)
        return Response(
            content=path.read_bytes(),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Cache-Control": "private, max-age=3600",
            },
        )

    # Remoto (R2, etc.) — stream
    parsed = urlparse(u)
    path_name = Path(parsed.path).name or "archivo"
    ext = Path(path_name).suffix or ".bin"
    download_name = _safe_filename(filename, Path(path_name).stem or "archivo", ext)
    guessed, _ = mimetypes.guess_type(download_name)
    media_type = guessed or "application/octet-stream"

    try:
        client = httpx.Client(timeout=120.0, follow_redirects=True)
        req = client.build_request("GET", u)
        res = client.send(req, stream=True)
        if res.status_code >= 400:
            client.close()
            raise HTTPException(502, f"No se pudo obtener el archivo ({res.status_code})")
        if res.headers.get("content-type"):
            ct = res.headers["content-type"].split(";")[0].strip()
            if ct and ct != "application/octet-stream":
                media_type = ct

        def iter_bytes():
            try:
                for chunk in res.iter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                res.close()
                client.close()

        return StreamingResponse(
            iter_bytes(),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Cache-Control": "private, max-age=3600",
            },
        )
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"No se pudo obtener el archivo: {exc}") from exc
