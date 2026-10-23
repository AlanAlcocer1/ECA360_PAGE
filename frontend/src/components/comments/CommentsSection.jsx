import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { MessageCircleHeart, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { commentsApi } from '../../services/api'
import { formatDate } from '../../lib/utils'
import { SparkleButton } from '../amicro/MicroInteractions'
import StarRating from './StarRating'

export default function CommentsSection({ eventId }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [ratingError, setRatingError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm()

  const pickRating = (n) => {
    setRating(n)
    if (n >= 1) setRatingError('')
  }

  const load = async () => {
    try {
      const { data } = await commentsApi.byEvent(eventId)
      setComments(data)
    } catch {
      toast.error('No se pudieron cargar los comentarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [eventId])

  const onSubmit = async (values) => {
    if (!rating || rating < 1 || rating > 5) {
      setRatingError('Elige al menos 1 estrella para publicar')
      toast.error('Elige al menos 1 estrella para publicar')
      return
    }
    setRatingError('')
    try {
      const { data } = await commentsApi.create({
        ...values,
        event_id: eventId,
        rating,
      })
      setComments((prev) => [data, ...prev])
      reset()
      setRating(0)
      setRatingError('')
      toast.success('¡Gracias por compartir!')
    } catch {
      toast.error('Error al publicar comentario')
    }
  }

  return (
    <section id="comentarios" className="relative scroll-mt-24 overflow-hidden border-t border-line pt-14">
      <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-brand/[0.07] blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
        className="relative"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-brand text-white">
            <MessageCircleHeart size={22} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Tu voz cuenta</p>
            <h2 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">Comparte tu experiencia</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Cuéntanos qué se sintió vivir este momento. No necesitas cuenta: solo tu nombre, una calificación de
              1 a 5 estrellas y lo que quieras dejar en el recuerdo.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="relative mt-8 border border-line bg-gradient-to-br from-white via-white to-surface/80 p-5 sm:p-7">
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">¿Cómo te llamas?</label>
            <input
              {...register('name', { required: 'Cuéntanos tu nombre', maxLength: 120 })}
              placeholder="Tu nombre"
              className="w-full border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand"
            />
            {errors.name && <p className="mt-1 text-xs text-brand">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Tu calificación</label>
            <StarRating value={rating} onChange={pickRating} interactive size={26} />
            {ratingError ? (
              <p className="mt-1.5 text-xs text-brand">{ratingError}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted">
                {rating > 0 ? `${rating} de 5 estrellas` : 'Toca las estrellas para calificar'}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Tu experiencia</label>
            <textarea
              {...register('content', { required: 'Escribe un poco de lo que viviste', maxLength: 2000 })}
              rows={4}
              placeholder="Escribe tu experiencia..."
              className="w-full resize-y border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-brand"
            />
            {errors.content && <p className="mt-1 text-xs text-brand">{errors.content.message}</p>}
          </div>
          <div className="justify-self-start">
            <SparkleButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Publicando...' : 'Publicar experiencia'}
            </SparkleButton>
          </div>
        </form>
      </div>

      <div className="mt-10 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          <Sparkles size={14} className="text-brand" />
          {loading ? 'Cargando...' : `${comments.length} experiencia${comments.length === 1 ? '' : 's'}`}
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="border border-dashed border-line bg-surface/50 px-5 py-8 text-center">
            <p className="font-display text-xl text-ink">Sé el primero en dejar huella</p>
            <p className="mt-1 text-sm text-muted">Tu mensaje puede inspirar a quienes vean este evento.</p>
          </div>
        )}

        {comments.map((c, i) => (
          <motion.article
            key={c.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i * 0.04, 0.24) }}
            className="border border-line bg-white p-5 transition hover:border-brand/25"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand/10 font-display text-lg font-semibold text-brand">
                {(c.name || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-semibold text-ink">{c.name}</h4>
                  <time className="text-xs text-muted">{formatDate(c.created_at)}</time>
                </div>
                <div className="mt-1.5">
                  <StarRating value={c.rating ?? 5} size={14} />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{c.content}</p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}
