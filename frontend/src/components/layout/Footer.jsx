import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BrandMark, useSiteSettings } from '../../context/SiteSettingsContext'
import { SOCIAL_LINKS } from '../../lib/socials'
import { SocialIcon } from '../social/SocialIcon'
import { Magnetic } from '../amicro/MicroInteractions'

function SocialRow({ item, index }) {
  const [hovered, setHovered] = useState(false)
  const effects = [
    {
      iconAnim: (h) =>
        h ? { y: [0, -2, 0, -2, 0], rotate: [0, -10, 10, -8, 0] } : { y: 0, rotate: 0 },
      iconTransition: { duration: 0.4 },
    },
    {
      iconAnim: (h) => ({ scale: h ? [1, 1.25, 1] : 1 }),
      iconTransition: { duration: 0.4 },
    },
    {
      iconAnim: (h) => ({ rotate: h ? 18 : 0 }),
      iconTransition: { type: 'spring', stiffness: 400, damping: 20 },
    },
    {
      iconAnim: (h) => ({ scale: h ? 1.15 : 1, y: h ? -2 : 0 }),
      iconTransition: { type: 'spring', stiffness: 500, damping: 22 },
    },
  ]
  const fx = effects[index % effects.length]

  return (
    <Magnetic strength={0.18} className="block">
      <motion.a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:border-white/25 hover:bg-white/[0.08]"
      >
        <motion.span
          animate={fx.iconAnim(hovered)}
          transition={fx.iconTransition}
          className="flex h-9 w-9 items-center justify-center text-white"
          style={{ background: item.color }}
        >
          <SocialIcon id={item.id} size={16} />
        </motion.span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-white">{item.label}</span>
          <span className="block truncate text-[11px] text-white/45">{item.handle}</span>
        </span>
      </motion.a>
    </Magnetic>
  )
}

export default function Footer() {
  const { settings } = useSiteSettings()

  return (
    <footer className="mt-24 border-t border-line bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="[&_.text-ink]:text-white">
            <BrandMark nameClassName="text-white" />
          </div>
          <p className="mt-3 max-w-sm text-sm text-white/60">{settings.footer_text}</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/55">
            <Link to="/" className="hover:text-white">
              Inicio
            </Link>
            <Link to="/#eventos" className="hover:text-white">
              Novedades | Eventos
            </Link>
            <Link to="/redes" className="hover:text-white">
              Redes
            </Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Síguenos</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {SOCIAL_LINKS.map((item, i) => (
              <SocialRow key={item.id} item={item} index={i} />
            ))}
          </div>
          <Link
            to="/redes"
            className="mt-4 inline-flex text-xs font-medium text-brand-light underline-offset-4 hover:underline"
          >
            Ver tarjeta con QR →
          </Link>
        </div>
      </div>
    </footer>
  )
}
