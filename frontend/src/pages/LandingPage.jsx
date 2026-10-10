import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSeo } from '../hooks/useSeo'
import { eventsApi, mediaUrl } from '../services/api'
import { useSiteSettings } from '../context/SiteSettingsContext'
import EventsBrowse from '../components/events/EventsBrowse'
import CommentsMarquee from '../components/comments/CommentsMarquee'
import SocialsModal from '../components/social/SocialsModal'
import {
  BLOG_IDEAS,
  CONTACTO,
  EVENTOS_MUESTRA,
  PAQUETES,
  waUrl,
} from '../lib/landingData'
import './landing.css'

function FotoCuadro({ src, aviso }) {
  if (src) {
    return <img className="foto" src={src} alt="" loading="lazy" />
  }
  return <div className="muestra-foto">{aviso}</div>
}

function LogoMark({ className = '' }) {
  const { settings } = useSiteSettings()
  if (settings.logo_url) {
    return <img src={mediaUrl(settings.logo_url)} alt="ECA MID" className={className} />
  }
  return <span className={`marca-logo ${className}`}>ECA</span>
}

/** Pool del muro: fotos individuales de galería/carrusel; fallback a covers o muestra. */
function buildMuroPiezas(photos, events) {
  const fromGallery = (photos || [])
    .filter((p) => p.url)
    .map((p) => ({
      titulo: p.title || 'Evento',
      foto: mediaUrl(p.url),
      muestra: false,
    }))

  const covers = (events || [])
    .filter((e) => e.cover_image)
    .map((e) => ({
      titulo: e.title,
      foto: mediaUrl(e.cover_image),
      muestra: false,
    }))

  const pool = fromGallery.length ? fromGallery : covers.length ? covers : EVENTOS_MUESTRA
  const minNeeded = 24
  const piezas = []
  while (piezas.length < minNeeded) {
    piezas.push(...pool)
  }
  return piezas.slice(0, Math.max(minNeeded, pool.length))
}

export default function LandingPage() {
  useSeo({
    title: 'ECA MID · Cabina de fotos y Plataforma 360 en Mérida',
    description:
      'Fotos impresas al instante y videos 360 en cámara lenta para XV años, bodas y celebraciones en Mérida y Yucatán.',
  })

  const grupos = useMemo(() => [...new Set(PAQUETES.map((p) => p.grupo))], [])
  const [primera, ...restoBlog] = BLOG_IDEAS
  const [muroPhotos, setMuroPhotos] = useState([])
  const [muroEvents, setMuroEvents] = useState([])
  const [redesOpen, setRedesOpen] = useState(false)
  const openRedes = useCallback(() => setRedesOpen(true), [])
  const closeRedes = useCallback(() => setRedesOpen(false), [])

  useEffect(() => {
    eventsApi
      .muralPhotos({ limit: 48, per_event: 10 })
      .then(({ data }) => setMuroPhotos(Array.isArray(data) ? data : []))
      .catch(() => {})
    eventsApi
      .list({ page: 1, page_size: 24 })
      .then(({ data }) => setMuroEvents(data.items || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, '')
    if (!id) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [])

  const muroPiezas = useMemo(
    () => buildMuroPiezas(muroPhotos, muroEvents),
    [muroPhotos, muroEvents],
  )

  const muroColumnas = useMemo(
    () =>
      Array.from({ length: 4 }, (_, c) => {
        const piezas = Array.from({ length: 6 }, (_, i) => muroPiezas[(c * 3 + i) % muroPiezas.length])
        return [...piezas, ...piezas]
      }),
    [muroPiezas],
  )

  return (
    <div className="landing-galeria">
      <header className="menu">
        <div className="envoltura">
          <a className="marca" href="#inicio">
            <LogoMark />
            ECA MID
          </a>
          <nav aria-label="Secciones">
            <a href="#eventos">Eventos</a>
            <a href="#paquetes">Paquetes</a>
            <a href="#blog">Blog</a>
            <button type="button" className="nav-btn" onClick={openRedes}>
              Redes
            </button>
          </nav>
        </div>
      </header>

      <section className="portada" id="inicio">
        <div className="muro" aria-hidden="true">
          {muroColumnas.map((col, ci) => (
            <div className="columna" key={ci}>
              {col.map((e, i) => (
                <div className="cuadro" key={`${ci}-${i}-${e.titulo}`}>
                  <FotoCuadro src={e.foto} aviso={e.titulo} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="envoltura">
          <span className="eyebrow">Cabina de fotos · Plataforma 360</span>
          <h1>
            ¿Te imaginas esta noche <em>en tu evento?</em>
          </h1>
          <p>
            Fotos impresas al instante y videos 360 en cámara lenta para XV años, bodas y celebraciones
            en Mérida y todo Yucatán.
          </p>
          <div className="acciones">
            <a className="btn btn-principal" href={waUrl()} target="_blank" rel="noopener noreferrer">
              Quiero algo así
            </a>
            <a className="btn btn-linea" href="#eventos">
              Ver eventos
            </a>
          </div>
        </div>
      </section>

      <section id="eventos">
        <div className="envoltura">
          <div className="cabecera">
            <div>
              <span className="eyebrow">Eventos</span>
              <h2>Novedades y eventos reales</h2>
            </div>
            <a
              className="btn btn-linea"
              href={CONTACTO.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              Más en Instagram
            </a>
          </div>
          <EventsBrowse tone="dark" />
        </div>
      </section>

      <CommentsMarquee />

      <section id="paquetes" style={{ background: 'var(--obsidiana-2)' }}>
        <div className="envoltura paquetes">
          <div className="intro">
            <span className="eyebrow">Paquetes</span>
            <h2 style={{ fontSize: 'clamp(2.2rem, 4.6vw, 3.5rem)', fontWeight: 400, marginTop: 16 }}>
              Elige tu experiencia
            </h2>
            <p>
              Cada paquete se adapta a la temática de tu evento. Toca “Cotizar” y te respondemos por
              WhatsApp con los detalles para tu fecha.
            </p>
          </div>
          <div>
            {grupos.map((g, i) => (
              <details key={g} open={i === 0}>
                <summary>{g}</summary>
                <div className="opciones">
                  {PAQUETES.filter((p) => p.grupo === g).map((p) => (
                    <div className="opcion" key={`${p.grupo}-${p.nombre}`}>
                      <strong>{p.nombre}</strong>
                      <p>
                        {p.texto} <span style={{ opacity: 0.7 }}>({p.duracion})</span>
                      </p>
                      <a
                        href={waUrl(`Hola ECA, me interesa el paquete ${p.nombre} (${p.grupo}).`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Cotizar
                      </a>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="blog">
        <div className="envoltura">
          <div className="cabecera">
            <div>
              <span className="eyebrow">Blog</span>
              <h2>Ideas y consejos</h2>
            </div>
          </div>
          <div className="blog">
            <a className="destacada" href="#blog">
              <div className="cuadro">
                <FotoCuadro src={primera.foto} aviso="Foto de la entrada" />
              </div>
              <span className="eyebrow">{primera.fecha || 'Próximamente'}</span>
              <h3>{primera.titulo}</h3>
              <p>{primera.resumen}</p>
            </a>
            <div className="resto">
              {restoBlog.map((b) => (
                <div className="entrada" key={b.titulo}>
                  <span className="eyebrow">{b.fecha || 'Próximamente'}</span>
                  <h3>{b.titulo}</h3>
                  <p>{b.resumen}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="cierre">
        <div className="envoltura">
          <LogoMark className="marca-logo" />
          <h2>
            Momentos que se viven, <em>recuerdos que permanecen.</em>
          </h2>
          <div className="acciones">
            <a className="btn btn-principal" href={waUrl()} target="_blank" rel="noopener noreferrer">
              Cuéntanos sobre tu evento
            </a>
          </div>
          <p className="numero">WhatsApp {CONTACTO.whatsappVisible}</p>
        </div>
      </section>

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
            <a href="#eventos">Descarga tus fotos</a>
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
