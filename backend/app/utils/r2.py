"""Cliente S3-compatible para Cloudflare R2."""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.config import get_settings


@lru_cache
def get_r2_client() -> BaseClient:
    settings = get_settings()
    if not settings.r2_endpoint or not settings.r2_access_key_id or not settings.r2_secret_access_key:
        raise RuntimeError(
            "R2 incompleto: define R2_ENDPOINT, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY"
        )
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint.rstrip("/"),
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def r2_public_url(key: str) -> str:
    settings = get_settings()
    base = (settings.r2_public_base_url or "").rstrip("/")
    if not base:
        raise RuntimeError("R2_PUBLIC_BASE_URL no configurada")
    return f"{base}/{key.lstrip('/')}"


def upload_bytes(
    *,
    key: str,
    data: bytes,
    content_type: str,
    cache_control: Optional[str] = "public, max-age=31536000, immutable",
) -> str:
    """Sube bytes a R2 y devuelve la URL pública."""
    settings = get_settings()
    client = get_r2_client()
    extra = {
        "Bucket": settings.r2_bucket,
        "Key": key,
        "Body": data,
        "ContentType": content_type or "application/octet-stream",
    }
    if cache_control:
        extra["CacheControl"] = cache_control
    client.put_object(**extra)
    return r2_public_url(key)


def upload_file_path(
    *,
    key: str,
    path: str,
    content_type: str,
    cache_control: Optional[str] = "public, max-age=31536000, immutable",
) -> str:
    settings = get_settings()
    client = get_r2_client()
    extra_args = {"ContentType": content_type or "application/octet-stream"}
    if cache_control:
        extra_args["CacheControl"] = cache_control
    client.upload_file(path, settings.r2_bucket, key, ExtraArgs=extra_args)
    return r2_public_url(key)
