import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { eventsApi } from '../../services/api'
import { useDebounce, useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { isEventToday, parseEventDate } from '../../lib/utils'
import EventCard, { EventCardSkeleton } from './EventCard'

/**
 * Listado público de eventos (búsqueda, año, scroll infinito).
 * Los del día van primero y más grandes.
 */
export default function EventsBrowse({ tone = 'light', onEventsChange, className = '' }) {
  const [events, setEvents] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('')
  const [years, setYears] = useState([])
  const debouncedSearch = useDebounce(search, 350)
  const dark = tone === 'dark'
  const onEventsChangeRef = useRef(onEventsChange)
  onEventsChangeRef.current = onEventsChange

  useEffect(() => {
    eventsApi.years().then(({ data }) => setYears(data)).catch(() => {})
  }, [])

  const fetchPage = useCallback(
    async (pageNum, replace = false) => {
      setLoading(true)
      try {
        const { data } = await eventsApi.list({
          page: pageNum,
          page_size: 9,
          search: debouncedSearch || undefined,
          year: year || undefined,
        })
        setEvents((prev) => {
          const next = replace ? data.items : [...prev, ...data.items]
          onEventsChangeRef.current?.(next)
          return next
        })
        setHasMore(data.has_more)
        setPage(pageNum)
      } catch {
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    },
    [debouncedSearch, year],
  )

  useEffect(() => {
    fetchPage(1, true)
  }, [fetchPage])

  const sentinelRef = useInfiniteScroll(hasMore, loading, () => fetchPage(page + 1))

  const { todayEvents, pastEvents } = useMemo(() => {
    const today = []
    const past = []
    for (const event of events) {
      if (isEventToday(event.event_date)) today.push(event)
      else past.push(event)
    }
    // Varios hoy: el más cercano a la hora actual primero
    const now = Date.now()
    today.sort((a, b) => {
      const ta = parseEventDate(a.event_date)?.getTime() ?? 0
      const tb = parseEventDate(b.event_date)?.getTime() ?? 0
      return Math.abs(ta - now) - Math.abs(tb - now)
    })
    return { todayEvents: today, pastEvents: past }
  }, [events])

  return (
    <div className={`events-browse ${dark ? 'events-browse--dark' : ''} ${className}`.trim()}>
      <div className="events-browse__filters">
        <div className="events-browse__search">
          <Search size={16} className="events-browse__search-icon" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar eventos..."
            className="events-browse__input"
          />
        </div>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="events-browse__select"
        >
          <option value="">Todos los años</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {todayEvents.length > 0 && (
        <div className="events-browse__hoy">
          <p className="events-browse__hoy-label">En curso hoy</p>
          <div className="events-browse__grid events-browse__grid--hoy">
            {todayEvents.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} tone={tone} featured />
            ))}
          </div>
        </div>
      )}

      {(pastEvents.length > 0 || loading) && (
        <div className={todayEvents.length > 0 ? 'events-browse__pasado' : undefined}>
          {todayEvents.length > 0 && pastEvents.length > 0 && (
            <p className="events-browse__pasado-label">Anteriores y novedades</p>
          )}
          <div className="events-browse__grid events-browse__grid--pasado">
            {pastEvents.map((event, i) => (
              <EventCard key={event.id} event={event} index={i} tone={tone} featured={false} />
            ))}
            {loading &&
              Array.from({ length: events.length ? 3 : 6 }).map((_, i) => (
                <EventCardSkeleton key={`sk-${i}`} tone={tone} />
              ))}
          </div>
        </div>
      )}

      {!loading && events.length === 0 && (
        <p className="events-browse__empty">No hay eventos publicados todavía.</p>
      )}

      <div ref={sentinelRef} className="events-browse__sentinel" />
    </div>
  )
}
