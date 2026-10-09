import { useEffect, useMemo, useState } from 'react'
import { UserRound } from 'lucide-react'
import { commentsApi } from '../../services/api'
import Marquee from '../ui/Marquee'
import StarRating from './StarRating'

function CommentCard({ comment }) {
  const inner = (
    <>
      <div className="comentario-marca__cabeza">
        <span className="comentario-marca__icono" aria-hidden>
          <UserRound size={18} strokeWidth={1.75} />
        </span>
        <div>
          <strong>{comment.name}</strong>
          {comment.event_title ? <span>{comment.event_title}</span> : null}
        </div>
      </div>
      <StarRating value={comment.rating ?? 5} size={13} className="comentario-marca__stars" />
      <blockquote>{comment.content}</blockquote>
    </>
  )

  if (comment.event_slug) {
    return (
      <a
        className="comentario-marca"
        href={`/evento/${comment.event_slug}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    )
  }

  return <figure className="comentario-marca">{inner}</figure>
}

export default function CommentsMarquee() {
  const [comments, setComments] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    commentsApi
      .recent({ limit: 30 })
      .then(({ data }) => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]))
      .finally(() => setLoaded(true))
  }, [])

  const { firstRow, secondRow } = useMemo(() => {
    if (!comments.length) return { firstRow: [], secondRow: [] }
    // Si hay pocos, se repiten para llenar la marquesina
    let pool = [...comments]
    while (pool.length < 4) pool = [...pool, ...comments]
    const mid = Math.ceil(pool.length / 2)
    return { firstRow: pool.slice(0, mid), secondRow: pool.slice(mid) }
  }, [comments])

  if (!loaded || comments.length === 0) return null

  return (
    <section id="voces" className="voces-marquee" aria-label="Comentarios de eventos">
      <div className="envoltura">
        <div className="cabecera">
          <div>
            <span className="eyebrow">Voces</span>
            <h2>Lo que dejan en cada evento</h2>
          </div>
        </div>
      </div>

      <div className="voces-marquee__rails">
        <Marquee pauseOnHover className="[--duration:36s]">
          {firstRow.map((c, i) => (
            <CommentCard key={`a-${c.id}-${i}`} comment={c} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:36s]">
          {(secondRow.length ? secondRow : firstRow).map((c, i) => (
            <CommentCard key={`b-${c.id}-${i}`} comment={c} />
          ))}
        </Marquee>
        <div className="voces-marquee__fade voces-marquee__fade--izq" aria-hidden />
        <div className="voces-marquee__fade voces-marquee__fade--der" aria-hidden />
      </div>
    </section>
  )
}
