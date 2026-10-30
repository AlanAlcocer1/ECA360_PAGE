import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { commentsApi } from '../../services/api'
import { dismissReviewPrompt } from '../../lib/reviewPrompt'
import StarRating from './StarRating'

/**
 * Modal al abrir un evento (solo 1ª vez por evento en este navegador).
 * Estrellas + comentario opcional. X pequeña para cerrar (invasivo a propósito).
 */
export default function EventReviewEntryModal({ open, eventId, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')

  useEffect(() => {
    if (!open) return
    setRating(0)
    setContent('')
    setName('')
    setRatingError('')
    setSubmitting(false)
  }, [open, eventId])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId])

  if (typeof document === 'undefined') return null

  const handleClose = () => {
    dismissReviewPrompt(eventId, 'omit')
    onClose?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rating || rating < 1) {
      setRatingError('Elige al menos 1 estrella')
      return
    }
    const trimmedName = (name || '').trim()
    if (!trimmedName) {
      setRatingError('')
      toast.error('Escribe tu nombre')
      return
    }
    setRatingError('')
    setSubmitting(true)
    try {
      await commentsApi.create({
        event_id: eventId,
        name: trimmedName,
        content: (content || '').trim() || '—',
        rating,
      })
      dismissReviewPrompt(eventId, 'done')
      toast.success('¡Gracias por tu opinión!')
      onSubmitted?.()
      onClose?.()
    } catch {
      toast.error('No se pudo enviar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-review-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Sin cerrar al tocar fondo: solo X (más invasivo) */}
          <div className="absolute inset-0 bg-black/60" aria-hidden />

          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden border border-line bg-white shadow-2xl"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div className="h-1.5 w-full bg-brand" />

            <button
              type="button"
              onClick={handleClose}
              className="absolute right-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-muted/70 hover:bg-black/5 hover:text-ink"
              aria-label="Cerrar"
            >
              <X size={12} strokeWidth={2.5} />
            </button>

            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-8 sm:px-8">
              <h2
                id="event-review-title"
                className="pr-6 font-display text-2xl font-semibold leading-tight text-ink sm:text-[1.65rem]"
              >
                ¿Queremos saber qué te parece el evento?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Tus comentarios nos ayudan a mejorar
              </p>

              <div className="mt-6">
                <label className="mb-2 block text-xs font-medium text-muted">Tu calificación</label>
                <StarRating
                  value={rating}
                  onChange={(n) => {
                    setRating(n)
                    setRatingError('')
                  }}
                  interactive
                  size={32}
                />
                {ratingError ? (
                  <p className="mt-1.5 text-xs text-brand">{ratingError}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted">
                    {rating > 0 ? `${rating} de 5 estrellas` : 'Toca las estrellas'}
                  </p>
                )}
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-muted">Tu nombre</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  placeholder="¿Cómo te llamas?"
                  className="w-full border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand"
                />
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  Comentario <span className="font-normal text-muted/70">(opcional)</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Cuéntanos qué te gustó…"
                  className="w-full resize-y border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-5 w-full bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                {submitting ? 'Enviando…' : 'Enviar opinión'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
