import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrandMark } from '../../context/SiteSettingsContext'
import { FocusBlurLinks } from '../amicro/MicroInteractions'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group" onClick={() => setOpen(false)}>
          <BrandMark />
        </Link>

        <nav className="hidden md:block">
          <FocusBlurLinks
            items={[
              { id: 'inicio', label: 'Inicio', to: '/' },
              { id: 'home', label: 'Novedades | Eventos', to: '/#eventos' },
              { id: 'redes', label: 'Redes', to: '/redes' },
            ]}
          />
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-ink md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menú"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              <Link
                to="/"
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface"
                onClick={() => setOpen(false)}
              >
                Inicio
              </Link>
              <Link
                to="/#eventos"
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface"
                onClick={() => setOpen(false)}
              >
                Novedades | Eventos
              </Link>
              <Link
                to="/redes"
                className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface"
                onClick={() => setOpen(false)}
              >
                Redes
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
