import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SOCIAL_BIO } from '../lib/socials'
import { useSiteSettings } from '../context/SiteSettingsContext'
import SocialsPanel from '../components/social/SocialsPanel'
import { useSeo } from '../hooks/useSeo'

export default function SocialsPage() {
  const { settings } = useSiteSettings()

  useSeo({
    title: `Redes — ${settings.site_name || 'ECA MID'}`,
    description: SOCIAL_BIO,
  })

  return (
    <div className="relative min-h-[80vh] overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--color-brand)_18%,transparent),_transparent_55%),linear-gradient(180deg,#0a0a0a_0%,#141414_45%,#1a1a1a_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

      <div className="relative mx-auto flex max-w-lg flex-col px-4 py-14 sm:px-6 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SocialsPanel />
        </motion.div>

        <p className="mt-8 text-center text-sm text-white/40">
          <Link to="/#eventos" className="text-white/70 underline-offset-4 hover:text-white hover:underline">
            Ver novedades y eventos
          </Link>
        </p>
      </div>
    </div>
  )
}
