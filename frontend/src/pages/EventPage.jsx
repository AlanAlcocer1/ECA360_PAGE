import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, MapPin, ArrowLeft } from 'lucide-react'
import { eventsApi, mediaUrl } from '../services/api'
import { useSeo } from '../hooks/useSeo'
import { formatDate } from '../lib/utils'
import { useSiteSettings } from '../context/SiteSettingsContext'
import BlockRenderer from '../components/blocks/BlockRenderer'
import CommentsSection from '../components/comments/CommentsSection'
import EventCard from '../components/events/EventCard'
import HireEcaFab from '../components/HireEcaFab'
import SocialsModal from '../components/social/SocialsModal'
import { CONTACTO } from '../lib/landingData'
import './landing.css'
import './event-page.css'

function LogoMark({ className = '' }) {
  const { settings } = useSiteSettings()
  if (settings.logo_url) {
    return <img src={mediaUrl(settings.logo_url)} alt="ECA MID" className={className} />
  }
  return <span className={`marca-logo ${className}`}>ECA</span>
}

export default function EventPage() {
  const { slug } = useParams()
  const [event, setEvent] = useState(null)
  const [related, setRelated] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [redesOpen, setRedesOpen] = useState(false)
  const openRedes = useCallback(() => setRedesOpen(true), [])
  const closeRedes = useCallback(() => setRedesOpen(false), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    Promise.all([eventsApi.getBySlug(slug), eventsApi.related(slug)])
      .then(([ev, rel]) => {
        if (cancelled) return
        setEvent(ev.data)
        setRelated(rel.data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const hasIngestCarousel = Boolean(
    event?.blocks?.some((b) => b.type === 'carousel' && b.settings?.ingest_code),
  )
  useEffect(() => {
    if (!hasIngestCarousel) return undefined
    const id = setInterval(() => {
      eventsApi
        .getBySlug(slug)
        .then(({ data }) => setEvent(data))
        .catch(() => {})
    }, 8000)
    return () => clearInterval(id)
  }, [slug, hasIngestCarousel])

  useSeo({
    title: event ? `${event.seo_title || event.title} | ECA MID` : 'Evento | ECA MID',
    description: event?.seo_description || event?.excerpt,
    image: event?.og_image || event?.cover_image ? mediaUrl(event.og_image || event.cover_image) : undefined,
  })

  return (
    <div className="landing-galeria evento-vista">
      <header className="menu">
        <div className="envoltura">
          <Link className="marca" to="/">
            <LogoMark />
            ECA MID
          </Link>
          <nav aria-label="Secciones">
            <Link to="/#eventos">Eventos</Link>
            <Link to="/#paquetes">Paquetes</Link>
            <button type="button" className="nav-btn" onClick={openRedes}>
              Redes
            </button>
          </nav>
        </div>
      </header>

      {loading && (
        <div className="envoltura evento-cuerpo">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton mt-6 h-14 w-3/4" />
          <div className="skeleton mt-8 aspect-video" />
        </div>
      )}

      {!loading && (error || !event) && (
        <div className="envoltura evento-cuerpo" style={{ textAlign: 'center', maxWidth: 520, marginInline: 'auto' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 400 }}>Evento no encontrado</h1>
          <Link to="/#eventos" className="btn btn-linea" style={{ marginTop: 28 }}>
            Volver a eventos
          </Link>
        </div>
      )}

      {!loading && event && (
        <>
          <article className="evento-cuerpo">
            <div className="envoltura" style={{ width: 'min(820px, 100%)' }}>
              <Link to="/#eventos" className="evento-volver">
                <ArrowLeft size={16} /> Todos los eventos
              </Link>

              {!event.blocks?.some((b) => b.type === 'hero') && (
                <header style={{ marginTop: 32 }}>
                  {event.template && (
                    <span className="eyebrow">{event.template.replace('_', ' ')}</span>
                  )}
                  <h1
                    style={{
                      fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
                      fontWeight: 400,
                      marginTop: 16,
                      maxWidth: '18ch',
                    }}
                  >
                    {event.title}
                  </h1>
                  {event.excerpt && (
                    <p style={{ marginTop: 18, maxWidth: '48ch', color: 'var(--plata)', fontSize: '1.05rem' }}>
                      {event.excerpt}
                    </p>
                  )}
                  <div className="evento-meta">
                    {event.event_date && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar size={15} /> {formatDate(event.event_date)}
                      </span>
                    )}
                    {event.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={15} /> {event.location}
                      </span>
                    )}
                  </div>
                  {event.cover_image && (
                    <div className="evento-cover">
                      <img src={mediaUrl(event.cover_image)} alt={event.title} />
                    </div>
                  )}
                </header>
              )}

              <div style={{ marginTop: event.blocks?.some((b) => b.type === 'hero') ? 0 : 48 }}>
                <BlockRenderer blocks={event.blocks || []} />
                <div style={{ marginTop: 64 }}>
                  <CommentsSection eventId={event.id} />
                </div>
              </div>
            </div>
          </article>

          {related.length > 0 && (
            <section className="evento-relacionados">
              <div className="envoltura">
                <h2>Eventos relacionados</h2>
                <div className="evento-relacionados__grid">
                  {related.map((ev, i) => (
                    <EventCard key={ev.id} event={ev} index={i} tone="dark" featured={false} />
                  ))}
                </div>
              </div>
            </section>
          )}

          <HireEcaFab />
        </>
      )}

      <footer className="pie">
        <div className="envoltura">
          <span>© ECA MID · Mérida, Yucatán</span>
          <nav>
            <a href={CONTACTO.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <a href={CONTACTO.facebook} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
            <Link to="/#eventos">Eventos</Link>
            <button type="button" className="pie-btn" onClick={openRedes}>
              Redes
            </button>
          </nav>
        </div>
      </footer>

      <SocialsModal open={redesOpen} onClose={closeRedes} />
    </div>
  )
}
