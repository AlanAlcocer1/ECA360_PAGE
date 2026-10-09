#!/bin/sh
set -eu

echo "==> ECA360 API — preparando /data"
mkdir -p /data/uploads/images /data/uploads/videos /data/uploads/thumbnails

# Si no hay DATABASE_URL, apunta al volume persistente
export DATABASE_URL="${DATABASE_URL:-sqlite:////data/eca360.db}"
export UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"

echo "==> Migraciones"
python -m app.db_migrate

echo "==> Uvicorn :${PORT:-8000}"
exec uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
