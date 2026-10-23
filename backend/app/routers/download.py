"""Descarga de imágenes como PNG (compatibilidad en dispositivos).

La web sirve WebP; al descargar convertimos a PNG bajo demanda.
"""

from __future__ import annotations

import io
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
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
