from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    DashboardStats,
    EventCreate,
    EventListItem,
    EventOut,
    EventPaginated,
    EventUpdate,
)
from app.services import events as event_service
from app.services.templates import list_templates
from app.utils.auth import require_admin

router = APIRouter(prefix="/events", tags=["events"])


def _to_list_item(db: Session, e) -> EventListItem:
    return EventListItem(
        id=e.id,
        title=e.title,
        slug=e.slug,
        excerpt=e.excerpt,
        cover_image=e.cover_image,
        event_date=e.event_date,
        location=e.location,
        template=e.template,
        status=e.status,
        year=e.year,
        created_at=e.created_at,
        updated_at=e.updated_at,
        comments_count=event_service.comments_count(db, e.id),
    )


def _to_out(db: Session, e) -> EventOut:
    item = _to_list_item(db, e)
    return EventOut(
        **item.model_dump(),
        seo_title=e.seo_title,
        seo_description=e.seo_description,
        og_image=e.og_image,
        blocks=sorted(e.blocks, key=lambda b: b.position),
    )


@router.get("", response_model=EventPaginated)
def get_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    search: str | None = None,
    year: int | None = None,
    status: str | None = None,
    admin: bool = False,
    db: Session = Depends(get_db),
    _auth: str | None = None,
):
    published_only = not admin
    if admin:
        # Will be validated by header in admin-specific routes; here allow status filter for public=false
        pass
    items, total = event_service.list_events(
        db,
        page=page,
        page_size=page_size,
        search=search,
        year=year,
        status=status if admin else None,
        published_only=published_only,
    )
    return EventPaginated(
        items=[_to_list_item(db, e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/admin/list", response_model=EventPaginated)
def admin_list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    year: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    items, total = event_service.list_events(
        db, page=page, page_size=page_size, search=search, year=year, status=status, published_only=False
    )
    return EventPaginated(
        items=[_to_list_item(db, e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/templates")
def get_templates():
    return list_templates()


@router.get("/years")
def get_years(db: Session = Depends(get_db)):
    from sqlalchemy import distinct
    from app.models import Event

    years = (
        db.query(distinct(Event.year))
        .filter(Event.status == "published", Event.year.isnot(None))
        .order_by(Event.year.desc())
        .all()
    )
    return [y[0] for y in years]


@router.get("/mural-photos")
def get_mural_photos(
    limit: int = Query(48, ge=6, le=120),
    per_event: int = Query(10, ge=1, le=24),
    db: Session = Depends(get_db),
):
    """Fotos individuales (galería/carrusel) para el muro de la landing — no solo covers."""
    return event_service.mural_photos(db, limit=limit, per_event=per_event)


@router.get("/slug/{slug}", response_model=EventOut)
def get_by_slug(slug: str, db: Session = Depends(get_db)):
    event = event_service.get_event_by_slug(db, slug, published_only=True)
    if not event:
        raise HTTPException(404, "Evento no encontrado")
    return _to_out(db, event)


@router.get("/slug/{slug}/related", response_model=list[EventListItem])
def get_related(slug: str, db: Session = Depends(get_db)):
    event = event_service.get_event_by_slug(db, slug, published_only=True)
    if not event:
        raise HTTPException(404, "Evento no encontrado")
    related = event_service.related_events(db, event)
    return [_to_list_item(db, e) for e in related]


@router.get("/admin/stats", response_model=DashboardStats)
def stats(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    return event_service.dashboard_stats(db)


@router.get("/{event_id}", response_model=EventOut)
def get_by_id(event_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    event = event_service.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(404, "Evento no encontrado")
    return _to_out(db, event)


@router.post("", response_model=EventOut)
def create_event(payload: EventCreate, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    event = event_service.create_event(db, payload)
    return _to_out(db, event)


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: int, payload: EventUpdate, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    try:
        event = event_service.update_event(db, event_id, payload)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _to_out(db, event)


@router.post("/{event_id}/duplicate", response_model=EventOut)
def duplicate_event(event_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    try:
        event = event_service.duplicate_event(db, event_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return _to_out(db, event)


@router.post("/{event_id}/publish", response_model=EventOut)
def publish_event(event_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    event = event_service.update_event(db, event_id, EventUpdate(status="published"))
    return _to_out(db, event)


@router.post("/{event_id}/hide", response_model=EventOut)
def hide_event(event_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    event = event_service.update_event(db, event_id, EventUpdate(status="hidden"))
    return _to_out(db, event)


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    ok = event_service.delete_event(db, event_id)
    if not ok:
        raise HTTPException(404, "Evento no encontrado")
    return {"success": True}
