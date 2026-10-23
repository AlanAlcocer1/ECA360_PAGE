#!/usr/bin/env python3
"""CLI wrapper — la lógica vive en app.services.r2_migrate.

Preferible: Admin → Migrar a R2 (UI con progreso).

  python scripts/migrate_uploads_to_r2.py
  python scripts/migrate_uploads_to_r2.py --apply
  python scripts/migrate_uploads_to_r2.py --apply --delete-local
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.r2_migrate import iter_migration  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrar /uploads locales a Cloudflare R2")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--delete-local", action="store_true")
    args = parser.parse_args()
    if args.delete_local and not args.apply:
        print("ERROR: --delete-local requiere --apply")
        sys.exit(2)

    exit_code = 0
    for ev in iter_migration(apply=args.apply, delete_local=args.delete_local):
        t = ev.get("type")
        if t == "start":
            print(
                f"start files={ev.get('file_count')} apply={ev.get('apply')} "
                f"delete={ev.get('delete_local')} public={ev.get('public_base')}"
            )
        elif t == "file":
            dest = ev.get("new_key") or ev.get("key")
            src = ev.get("key")
            arrow = f" → {dest}" if dest and dest != src else ""
            print(
                f"  [{ev.get('action')}] {ev.get('index')}/{ev.get('total')} "
                f"{src}{arrow} ({ev.get('size_mb')} MB)"
            )
        elif t == "file_error":
            print(f"  [ERR] {ev.get('key') or ev.get('path')}: {ev.get('message')}")
            exit_code = 1
        elif t == "upload_summary":
            print(f"upload_summary {ev}")
        elif t == "db":
            print(f"db {ev.get('action')} rows={ev.get('rows')}")
        elif t == "delete":
            print(f"  [delete {ev.get('action')}] {ev.get('key')}")
        elif t == "delete_summary":
            print(f"deleted={ev.get('deleted')}")
        elif t == "delete_skipped":
            print(ev.get("message"))
            exit_code = 1
        elif t == "error":
            print("ERROR:", ev.get("message"))
            exit_code = 1
        elif t == "done":
            print(ev.get("message"), ev.get("stats"))
            if not ev.get("ok"):
                exit_code = 1
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
