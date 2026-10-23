import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SOCIAL_LINKS } from '../lib/socials'

const whatsapp = SOCIAL_LINKS.find((s) => s.id === 'whatsapp')
const HIRE_URL = whatsapp?.href || 'https://www.instagram.com/eca_mid'

function WhatsAppMark({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.41.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.46h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.29 0 1.35.99 2.66 1.13 2.84.14.18 1.95 2.98 4.73 4.18.66.29 1.18.46 1.58.59.66.21 1.27.18 1.75.11.53-.08 1.6-.65 1.83-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z" />
      <path d="M12.04 2C6.58 2 2.15 6.43 2.15 11.89c0 1.75.46 3.45 1.34 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.89-4.43 9.89-9.89C21.94 6.43 17.51 2 12.04 2zm0 18.07h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.18 8.18 0 0 1-1.26-4.37c0-4.53 3.69-8.21 8.22-8.21 4.53 0 8.22 3.68 8.22 8.21 0 4.53-3.69 8.25-8.19 8.25z" />
    </svg>
  )
}

/** En cel: círculo WhatsApp. En desktop: pill con texto. Se oculta si la galería fullscreen está abierta. */
export default function HireEcaFab() {
  const [galleryOpen, setGalleryOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      setGalleryOpen(document.body.classList.contains('eca-gallery-open'))
    }
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return (
    <AnimatePresence>
      {!galleryOpen && (
        <motion.div
          className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-[90] sm:right-5"
          initial={{ y: 64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.2 }}
        >
          {/* Móvil: solo círculo WhatsApp */}
          <motion.a
            href={HIRE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contratar ECA por WhatsApp"
            className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_28px_-6px_rgba(37,211,102,0.65)] sm:hidden"
            whileTap={{ scale: 0.94 }}
          >
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-[#25D366]/60"
              animate={{ opacity: [0.2, 0.7, 0.2], scale: [1, 1.12, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <WhatsAppMark className="relative h-7 w-7" />
          </motion.a>

          {/* Desktop: pill con texto */}
          <motion.a
            href={HIRE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto relative hidden max-w-xs items-center gap-3 overflow-hidden rounded-full bg-[var(--rubi,#b11226)] px-4 py-2.5 text-white shadow-[0_12px_40px_-8px_rgba(177,18,38,0.65)] sm:flex"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ['-120%', '140%'] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
            />
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#25D366]">
              <WhatsAppMark className="h-6 w-6" />
            </span>
            <span className="relative min-w-0 flex-1 text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">
                Tu evento también puede verse así
              </span>
              <span className="block text-sm font-semibold leading-tight">Quiero contratar ECA</span>
            </span>
          </motion.a>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
