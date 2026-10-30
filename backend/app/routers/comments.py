from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Comment, Event
from app.schemas import CommentCreate, CommentOut, CommentPaginated
from app.utils.auth import require_admin

router = APIRouter(prefix="/comments", tags=["comments"])


def _to_out(c: Comment) -> CommentOut:
    return CommentOut(
        id=c.id,
        event_id=c.event_id,
        name=c.name,
        content=c.content,
        rating=getattr(c, "rating", None) or 5,
        approved=c.approved,
        created_at=c.created_at,
        event_title=c.event.title if c.event else None,
        event_slug=c.event.slug if c.event else None,
    )


@router.post("", response_model=CommentOut)
def create_comment(payload: CommentCreate, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == payload.event_id, Event.status == "published").first()
    if not event:
        raise HTTPException(404, "Evento no encontrado")
    name = (payload.name or "").strip() or "Anónimo"
    content = (payload.content or "").strip() or "—"
    comment = Comment(
        event_id=payload.event_id,
        name=name,
        content=content,
        rating=payload.rating,
        approved=True,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    comment.event = event
    return _to_out(comment)


@router.get("/event/{event_id}", response_model=list[CommentOut])
def comments_by_event(event_id: int, db: Session = Depends(get_db)):
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.event))
        .filter(Comment.event_id == event_id, Comment.approved.is_(True))
        .order_by(Comment.created_at.desc())
        .all()
    )
    return [_to_out(c) for c in comments]


@router.get("/recent", response_model=list[CommentOut])
def comments_recent(
    limit: int = Query(24, ge=1, le=60),
    db: Session = Depends(get_db),
):
    """Comentarios aprobados de eventos publicados (para marquesinas públicas)."""
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.event))
        .join(Event, Event.id == Comment.event_id)
        .filter(Comment.approved.is_(True), Event.status == "published")
        .order_by(Comment.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_to_out(c) for c in comments]


@router.get("/admin/list", response_model=CommentPaginated)
def admin_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    q = db.query(Comment).options(joinedload(Comment.event))
    if search:
        like = f"%{search}%"
        q = q.filter(or_(Comment.name.ilike(like), Comment.content.ilike(like)))
    total = q.count()
    items = q.order_by(Comment.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return CommentPaginated(
        items=[_to_out(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/{comment_id}/approve", response_model=CommentOut)
def approve_comment(comment_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    comment = db.query(Comment).options(joinedload(Comment.event)).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(404, "Comentario no encontrado")
    comment.approved = True
    db.commit()
    db.refresh(comment)
    return _to_out(comment)


@router.patch("/{comment_id}/disable", response_model=CommentOut)
def disable_comment(comment_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    comment = db.query(Comment).options(joinedload(Comment.event)).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(404, "Comentario no encontrado")
    comment.approved = False
    db.commit()
    db.refresh(comment)
    return _to_out(comment)


@router.delete("/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), _: str = Depends(require_admin)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(404, "Comentario no encontrado")
    db.delete(comment)
    db.commit()
    return {"success": True}
