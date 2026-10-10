from __future__ import annotations

import random
from datetime import datetime
from typing import Any, Optional

from slugify import slugify
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models import Comment, Event, EventBlock, MediaFile
from app.schemas import EventCreate, EventUpdate
from app.services.templates import get_template_blocks


def _block_image_urls(content: dict[str, Any] | None, block_type: str) -> list[str]:
    """Fotos individuales de un bloque (carousel / gallery / image), no el cover."""
    c = content or {}
    urls: list[str] = []
    if block_type == "image":
        u = c.get("url") or c.get("image")
        if u:
            urls.append(u)
    elif block_type == "gallery":
        for img in c.get("images") or []:
            u = img if isinstance(img, str) else (img.get("url") or img.get("src"))
            if u:
                urls.append(u)
    elif block_type == "carousel":
        for item in c.get("items") or []:
            kind = item.get("type") or "image"
            if kind != "image":
                continue
            u = item.get("url") or item.get("src")
            if u:
                urls.append(u)
    return urls


def mural_photos(db: Session, *, limit: int = 48, per_event: int = 10) -> list[dict[str, str]]:
    """Muestra variada de fotos de galería/carrusel de eventos publicados."""
    events = (
        db.query(Event)
        .options(joinedload(Event.blocks))
        .filter(Event.status == "published")
        .order_by(Event.event_date.desc(), Event.created_at.desc())
        .all()
    )
    buckets: list[list[dict[str, str]]] = []
    for event in events:
        urls: list[str] = []
        for block in sorted(event.blocks, key=lambda b: b.position):
            urls.extend(_block_image_urls(block.content, block.type))
        # Dedup preservando orden
        seen: set[str] = set()
        unique = []
        for u in urls:
            if u in seen:
                continue
            seen.add(u)
            unique.append(u)
        if not unique:
            continue
        random.shuffle(unique)
        sample = unique[:per_event]
        buckets.append([{"url": u, "title": event.title, "slug": event.slug} for u in sample])

    if not buckets:
        return []

    # Round-robin entre eventos para que el muro no sea de uno solo
    mixed: list[dict[str, str]] = []
    while len(mixed) < limit and any(buckets):
        for bucket in buckets:
            if len(mixed) >= limit:
                break
            if bucket:
                mixed.append(bucket.pop(0))
        buckets = [b for b in buckets if b]
    return mixed


def unique_slug(db: Session, title: str, exclude_id: Optional[int] = None) -> str:
    base = slugify(title) or "evento"
    slug = base
    n = 1
    while True:
        q = db.query(Event).filter(Event.slug == slug)
        if exclude_id:
            q = q.filter(Event.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def _apply_blocks(db: Session, event: Event, blocks_data: list) -> None:
    db.query(EventBlock).filter(EventBlock.event_id == event.id).delete()
    for i, b in enumerate(blocks_data):
        data = b.model_dump() if hasattr(b, "model_dump") else dict(b)
        block = EventBlock(
            event_id=event.id,
            type=data["type"],
            position=data.get("position", i),
            content=data.get("content") or {},
            settings=data.get("settings") or {},
        )
        db.add(block)


def create_event(db: Session, payload: EventCreate) -> Event:
    slug = payload.slug or unique_slug(db, payload.title)
    year = payload.event_date.year if payload.event_date else datetime.utcnow().year

    blocks = payload.blocks
    if payload.template and not blocks:
        blocks = get_template_blocks(payload.template)

    seo_title = payload.seo_title or payload.title
    seo_description = payload.seo_description or (payload.excerpt or "")[:160]

    event = Event(
        title=payload.title,
        slug=slug,
        excerpt=payload.excerpt,
        cover_image=payload.cover_image,
        event_date=payload.event_date,
        location=payload.location,
        template=payload.template,
        status=payload.status or "draft",
        seo_title=seo_title,
        seo_description=seo_description,
        og_image=payload.og_image or payload.cover_image,
        year=year,
    )
    db.add(event)
    db.flush()

    for i, b in enumerate(blocks):
        data = b.model_dump() if hasattr(b, "model_dump") else dict(b)
        db.add(
            EventBlock(
                event_id=event.id,
                type=data["type"],
                position=data.get("position", i),
                content=data.get("content") or {},
                settings=data.get("settings") or {},
            )
        )

    db.commit()
    db.refresh(event)
    return get_event_by_id(db, event.id)


def update_event(db: Session, event_id: int, payload: EventUpdate) -> Event:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise ValueError("Evento no encontrado")

    data = payload.model_dump(exclude_unset=True)
    blocks = data.pop("blocks", None)

    if "title" in data and "slug" not in data:
        pass
    if "slug" in data and data["slug"]:
        data["slug"] = unique_slug(db, data["slug"], exclude_id=event_id)
    elif "title" in data:
        # keep existing slug unless explicitly changed
        pass

    for key, value in data.items():
        setattr(event, key, value)

    if event.event_date:
        event.year = event.event_date.year
    if not event.seo_title:
        event.seo_title = event.title
    if not event.og_image:
        event.og_image = event.cover_image

    event.updated_at = datetime.utcnow()

    if blocks is not None:
        _apply_blocks(db, event, blocks)

    db.commit()
    return get_event_by_id(db, event_id)


def duplicate_event(db: Session, event_id: int) -> Event:
    source = get_event_by_id(db, event_id)
    if not source:
        raise ValueError("Evento no encontrado")

    new_title = f"{source.title} (copia)"
    event = Event(
        title=new_title,
        slug=unique_slug(db, new_title),
        excerpt=source.excerpt,
        cover_image=source.cover_image,
        event_date=source.event_date,
        location=source.location,
        template=source.template,
        status="draft",
        seo_title=source.seo_title,
        seo_description=source.seo_description,
        og_image=source.og_image,
        year=source.year,
    )
    db.add(event)
    db.flush()

    for b in source.blocks:
        db.add(
            EventBlock(
                event_id=event.id,
                type=b.type,
                position=b.position,
                content=dict(b.content or {}),
                settings=dict(b.settings or {}),
            )
        )
    db.commit()
    return get_event_by_id(db, event.id)


def delete_event(db: Session, event_id: int) -> bool:
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return False
    db.delete(event)
    db.commit()
    return True


def get_event_by_id(db: Session, event_id: int) -> Optional[Event]:
    return (
        db.query(Event)
        .options(joinedload(Event.blocks), joinedload(Event.comments))
        .filter(Event.id == event_id)
        .first()
    )


def get_event_by_slug(db: Session, slug: str, published_only: bool = True) -> Optional[Event]:
    q = (
        db.query(Event)
        .options(joinedload(Event.blocks), joinedload(Event.comments))
        .filter(Event.slug == slug)
    )
    if published_only:
        q = q.filter(Event.status == "published")
    return q.first()


def list_events(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 12,
    search: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    published_only: bool = False,
) -> tuple[list[Event], int]:
    q = db.query(Event)
    if published_only:
        q = q.filter(Event.status == "published")
    elif status:
        q = q.filter(Event.status == status)

    if year:
        q = q.filter(Event.year == year)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Event.title.ilike(like), Event.excerpt.ilike(like), Event.location.ilike(like)))

    total = q.count()
    items = (
        q.order_by(Event.event_date.desc(), Event.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def related_events(db: Session, event: Event, limit: int = 3) -> list[Event]:
    q = db.query(Event).filter(Event.status == "published", Event.id != event.id)
    if event.template:
        q = q.filter(Event.template == event.template)
    items = q.order_by(Event.event_date.desc()).limit(limit).all()
    if len(items) < limit:
        extra = (
            db.query(Event)
            .filter(
                Event.status == "published",
                Event.id != event.id,
                ~Event.id.in_([e.id for e in items] or [0]),
            )
            .order_by(Event.created_at.desc())
            .limit(limit - len(items))
            .all()
        )
        items.extend(extra)
    return items


def comments_count(db: Session, event_id: int) -> int:
    return db.query(func.count(Comment.id)).filter(Comment.event_id == event_id, Comment.approved.is_(True)).scalar() or 0


def dashboard_stats(db: Session) -> dict:
    return {
        "total_events": db.query(func.count(Event.id)).scalar() or 0,
        "published_events": db.query(func.count(Event.id)).filter(Event.status == "published").scalar() or 0,
        "draft_events": db.query(func.count(Event.id)).filter(Event.status == "draft").scalar() or 0,
        "total_comments": db.query(func.count(Comment.id)).scalar() or 0,
        "pending_comments": db.query(func.count(Comment.id)).filter(Comment.approved.is_(False)).scalar() or 0,
        "total_media": db.query(func.count(MediaFile.id)).scalar() or 0,
    }
