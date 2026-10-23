import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircleHeart, X } from 'lucide-react'
import { dismissReviewPrompt } from '../../lib/reviewPrompt'

/**
 * Modal post-descarga: invita a dejar reseña del evento.
 * "Después" / "Omitir" guardan en localStorage para no repetir en este evento.
 */
export default function ReviewAfterDownloadModal({
  open,
  eventId,
  eventTitle,
  onClose,
  onLeaveReview,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') handleLater()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId])

  if (typeof document === 'undefined') return null

  const handleLater = () => {
    dismissReviewPrompt(eventId, 'later')
    onClose?.()
  }

  const handleOmit = () => {
    dismissReviewPrompt(eventId, 'omit')
    onClose?.()
  }

  const handleReview = () => {
    dismissReviewPrompt(eventId, 'done')
    onClose?.()
    onLeaveReview?.()
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-download-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Cerrar"
            onClick={handleLater}
          />
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
              onClick={handleLater}
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center text-muted hover:text-ink"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="px-6 pb-6 pt-7 sm:px-8">
              <span className="inline-flex h-12 w-12 items-center justify-center bg-brand text-white">
                <MessageCircleHeart size={22} />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                Tu opinión cuenta
              </p>
              <h2
                id="review-download-title"
                className="mt-1 font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl"
              >
                ¿Qué te pareció el evento?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {eventTitle
                  ? `No olvides dejar tu reseña de “${eventTitle}”. Ayuda a otros y nos encanta leerlas.`
                  : 'No olvides dejar tu reseña. Solo toma un minuto y nos ayuda un montón.'}
              </p>

              <button
                type="button"
                onClick={handleReview}
                className="mt-6 w-full bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Dejar mi reseña
              </button>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleLater}
                  className="flex-1 border border-line px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface"
                >
                  Después
                </button>
                <button
                  type="button"
                  onClick={handleOmit}
                  className="flex-1 px-3 py-2.5 text-sm text-muted hover:text-ink"
                >
                  Omitir
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
