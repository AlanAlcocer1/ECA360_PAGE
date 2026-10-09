import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, MapPin } from 'lucide-react'
import { formatDate, isEventToday } from '../../lib/utils'
import { mediaUrl } from '../../services/api'

export default function EventCard({ event, index = 0, tone = 'light', featured: featuredProp }) {
  const dark = tone === 'dark'
  const featured = featuredProp ?? isEventToday(event.event_date)
  const href = `/evento/${event.slug}`
  const entrances = [
    { opacity: 0, y: 28 },
    { opacity: 0, scale: 0.94, rotate: -1.5 },
    { opacity: 0, x: -20 },
  ]
  const initial = entrances[index % entrances.length]

  const CardLink = dark
    ? ({ children, className }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
          {children}
        </a>
      )
    : ({ children, className }) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )

  return (
    <motion.article
      initial={initial}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: (index % 6) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: featured ? -4 : -6 }}
      className={`group event-card ${dark ? 'event-card--dark' : ''} ${featured ? 'event-card--hoy' : 'event-card--pasado'}`}
    >
      <CardLink className="block">
        <div
          className={
            dark
              ? 'event-card__media relative overflow-hidden bg-[#211f26]'
              : 'event-card__media relative overflow-hidden bg-surface shadow-sm transition group-hover:shadow-lg'
          }
        >
          {featured && (
            <span className="event-card__badge" aria-label="Evento de hoy">
              Hoy
            </span>
          )}
          {event.cover_image ? (
            <motion.img
              src={mediaUrl(event.cover_image)}
              alt={event.title}
              loading="lazy"
              className="h-full w-full object-cover"
              whileHover={{ scale: 1.07 }}
              transition={{ duration: 0.7 }}
            />
          ) : (
            <div
              className={
                dark
                  ? 'flex h-full w-full items-center justify-center bg-gradient-to-br from-[#211f26] to-[#121115]'
                  : 'flex h-full w-full items-center justify-center bg-gradient-to-br from-surface to-line'
              }
            >
              <span
                className={
                  dark
                    ? 'font-display text-4xl text-white/25'
                    : 'font-display text-4xl text-muted/40'
                }
              >
                ECA MID
              </span>
            </div>
          )}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
          />
        </div>
        <div className="event-card__body pt-4">
          {event.template && (
            <p
              className={
                dark
                  ? 'mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--rubi-vivo,#e2384f)]'
                  : 'mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand'
              }
            >
              {event.template.replace('_', ' ')}
            </p>
          )}
          <h3
            className={
              dark
                ? `font-display font-semibold leading-tight text-[#f6f1ec] transition group-hover:text-[var(--rubi-vivo,#e2384f)] ${featured ? 'text-3xl sm:text-4xl' : 'text-xl'}`
                : `font-display font-semibold leading-tight text-ink transition group-hover:text-brand ${featured ? 'text-3xl sm:text-4xl' : 'text-xl'}`
            }
          >
            {event.title}
          </h3>
          {event.excerpt && (
            <p
              className={
                dark
                  ? `mt-2 leading-relaxed text-[#b8b8bc] ${featured ? 'line-clamp-3 text-base' : 'line-clamp-2 text-sm'}`
                  : `mt-2 leading-relaxed text-muted ${featured ? 'line-clamp-3 text-base' : 'line-clamp-2 text-sm'}`
              }
            >
              {event.excerpt}
            </p>
          )}
          <div
            className={
              dark
                ? 'mt-3 flex flex-wrap gap-3 text-xs text-[#b8b8bc]'
                : 'mt-3 flex flex-wrap gap-3 text-xs text-muted'
            }
          >
            {event.event_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={13} /> {formatDate(event.event_date)}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {event.location}
              </span>
            )}
          </div>
        </div>
      </CardLink>
    </motion.article>
  )
}

export function EventCardSkeleton({ tone = 'light', featured = false }) {
  const dark = tone === 'dark'
  return (
    <div className={featured ? 'event-card--hoy' : 'event-card--pasado'}>
      <div className={`skeleton event-card__media rounded-none ${dark ? 'opacity-20' : ''}`} />
      <div className="mt-4 space-y-2">
        <div className={`skeleton h-3 w-20 ${dark ? 'opacity-20' : ''}`} />
        <div className={`skeleton h-7 w-4/5 ${dark ? 'opacity-20' : ''}`} />
        <div className={`skeleton h-4 w-full ${dark ? 'opacity-20' : ''}`} />
        <div className={`skeleton h-4 w-2/3 ${dark ? 'opacity-20' : ''}`} />
      </div>
    </div>
  )
}
