from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Blocks ──────────────────────────────────────────────────────────────────

class BlockBase(BaseModel):
    type: str
    position: int = 0
    content: dict[str, Any] = Field(default_factory=dict)
    settings: dict[str, Any] = Field(default_factory=dict)


class BlockCreate(BlockBase):
    pass


class BlockUpdate(BlockBase):
    id: Optional[int] = None


class BlockOut(BlockBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_id: int
    created_at: datetime


# ── Events ──────────────────────────────────────────────────────────────────

class EventBase(BaseModel):
    title: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    event_date: Optional[datetime] = None
    location: Optional[str] = None
    template: Optional[str] = None
    status: str = "draft"
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image: Optional[str] = None


class EventCreate(EventBase):
    blocks: list[BlockCreate] = Field(default_factory=list)
    slug: Optional[str] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    event_date: Optional[datetime] = None
    location: Optional[str] = None
    template: Optional[str] = None
    status: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image: Optional[str] = None
    blocks: Optional[list[BlockUpdate]] = None


class EventListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    slug: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    event_date: Optional[datetime] = None
    location: Optional[str] = None
    template: Optional[str] = None
    status: str
    year: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    comments_count: int = 0


class EventOut(EventListItem):
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image: Optional[str] = None
    blocks: list[BlockOut] = Field(default_factory=list)


class EventPaginated(BaseModel):
    items: list[EventListItem]
    total: int
    page: int
    page_size: int
    has_more: bool


# ── Comments ────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    content: str = Field(..., min_length=1, max_length=2000)
    event_id: int
    rating: int = Field(5, ge=1, le=5)


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_id: int
    name: str
    content: str
    rating: int = 5
    approved: bool
    created_at: datetime
    event_title: Optional[str] = None
    event_slug: Optional[str] = None


class CommentPaginated(BaseModel):
    items: list[CommentOut]
    total: int
    page: int
    page_size: int


# ── Auth / Upload ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: str
    message: str = "OK"


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    original_name: str
    media_type: str
    mime_type: str
    url: str
    thumbnail_url: Optional[str] = None
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    created_at: datetime


class DashboardStats(BaseModel):
    total_events: int
    published_events: int
    draft_events: int
    total_comments: int
    pending_comments: int
    total_media: int


class SiteSettings(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    site_name: str = "ECA360"
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    hero_eyebrow: str = "ECA360"
    hero_title: str = "Eventos que se cuentan en imágenes"
    hero_subtitle: str = "Explora galerías, videos y momentos de bodas, XV años, graduaciones y más."
    footer_text: str = "Historias visuales de eventos inolvidables. Bodas, XV años, graduaciones y más."
    color_brand: str = "#C1121F"
    color_brand_dark: str = "#9B0E18"
    color_ink: str = "#0A0A0A"
    color_surface: str = "#F5F5F5"
    seo_title: str = "ECA360 Eventos — Historias que se viven"
    seo_description: str = "Blog de eventos ECA360: bodas, XV años, graduaciones y eventos corporativos."
    public_site_url: str = "https://eca360.com.mx"


class SiteSettingsUpdate(BaseModel):
    site_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    hero_eyebrow: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    footer_text: Optional[str] = None
    color_brand: Optional[str] = None
    color_brand_dark: Optional[str] = None
    color_ink: Optional[str] = None
    color_surface: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    public_site_url: Optional[str] = None
