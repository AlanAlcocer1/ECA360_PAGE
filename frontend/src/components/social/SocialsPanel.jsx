import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, ExternalLink, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { SOCIAL_BIO, SOCIAL_LINKS } from '../../lib/socials'
import { BrandMark, useSiteSettings } from '../../context/SiteSettingsContext'
import { SocialIcon } from './SocialIcon'
import { Magnetic, MorphButton } from '../amicro/MicroInteractions'

function SocialLinkRow({ item, index }) {
  const [hovered, setHovered] = useState(false)

  const variants = {
    instagram: {
      icon: hovered
        ? { y: [0, -2, 0, -2, 0], rotate: [0, -12, 12, -10, 0] }
        : { y: 0, rotate: 0 },
      iconT: { duration: 0.4 },
    },
    facebook: {
      icon: { x: hovered ? -2 : 0 },
      iconT: { type: 'spring', stiffness: 500, damping: 28 },
    },
    whatsapp: {
      icon: { scale: hovered ? [1, 1.22, 1] : 1 },
      iconT: { duration: 0.4 },
    },
    linktree: {
      icon: { scale: hovered ? 1.12 : 1, rotate: hovered ? -8 : 0 },
      iconT: { type: 'spring', stiffness: 400, damping: 18 },
    },
  }
  const fx = variants[item.id] || variants.whatsapp

  return (
    <Magnetic strength={index % 2 === 0 ? 0.2 : 0.12} className="block">
      <motion.a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileHover={{ scale: 1.015, x: 3 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 * index + 0.12 }}
        className="relative flex items-center gap-4 overflow-hidden border border-white/10 bg-white/[0.06] px-4 py-3.5 transition hover:border-white/25 hover:bg-white/[0.1]"
      >
        <motion.span
          animate={fx.icon}
          transition={fx.iconT}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-white"
          style={{ background: item.color }}
        >
          <SocialIcon id={item.id} size={20} />
        </motion.span>
        <span className="min-w-0 flex-1 text-left">
          {item.id === 'linktree' ? (
            <span className="relative block h-5 overflow-hidden text-sm font-semibold text-white">
              <motion.span
                animate={{ y: hovered ? -20 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex flex-col"
              >
                <span className="h-5 leading-5">{item.label}</span>
                <span className="h-5 leading-5">{item.handle}</span>
              </motion.span>
            </span>
          ) : (
            <>
              <span className="block text-sm font-semibold text-white">{item.label}</span>
              <span className="block truncate text-xs text-white/50">{item.handle}</span>
            </>
          )}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          {item.id === 'facebook' && hovered ? (
            <motion.span
              key="ar"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="text-white/70"
            >
              <ArrowRight size={16} />
            </motion.span>
          ) : (
            <motion.span key="ext" className="text-white/40">
              <ExternalLink size={16} />
            </motion.span>
          )}
        </AnimatePresence>

        {item.id === 'instagram' && (
          <motion.span
            aria-hidden
            animate={{ x: hovered ? ['-120%', '140%'] : '-120%' }}
            transition={{ duration: 0.8, ease: 'easeInOut', repeat: hovered ? Infinity : 0, repeatDelay: 0.9 }}
            className="pointer-events-none absolute inset-y-0 w-12 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
        )}
      </motion.a>
    </Magnetic>
  )
}

/** Contenido de la tarjeta de redes (página /redes y modal de landing). */
export default function SocialsPanel() {
  const { settings } = useSiteSettings()
  const [copied, setCopied] = useState(false)
  const shareUrl = useMemo(() => {
    let base = (settings.public_site_url || 'https://eca360.com.mx').trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`
    return `${base}/redes`
  }, [settings.public_site_url])

  const shareLabel = useMemo(() => {
    try {
      const u = new URL(shareUrl)
      return `${u.host}${u.pathname}`.replace(/\/$/, '') || shareUrl
    } catch {
      return shareUrl.replace(/^https?:\/\//i, '')
    }
  }, [shareUrl])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copiado')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div className="overflow-hidden border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-md sm:p-8">
      <div className="flex flex-col items-center text-center">
        <Magnetic strength={0.2}>
          <div className="[&_.text-ink]:text-white [&_span.text-ink]:text-white">
            <BrandMark name="ECA MID" nameClassName="text-white" />
          </div>
        </Magnetic>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
          Redes sociales
        </p>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">{SOCIAL_BIO}</p>
      </div>

      <div className="mt-8 space-y-3">
        {SOCIAL_LINKS.map((item, i) => (
          <SocialLinkRow key={item.id} item={item} index={i} />
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 border-t border-white/10 pt-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
          Escanea o comparte
        </p>
        <motion.div
          whileHover={{ rotate: 2, scale: 1.03 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="bg-white p-3"
        >
          <QRCodeSVG
            value={shareUrl}
            size={148}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#0A0A0A"
          />
        </motion.div>
        <p className="max-w-[220px] break-all text-center text-[11px] text-white/40">{shareLabel}</p>
        <MorphButton
          idleLabel="Copiar link de esta tarjeta"
          activeLabel="¡Copiado!"
          idleIcon={Share2}
          activeIcon={Check}
          active={copied}
          onClick={copyLink}
        />
      </div>
    </div>
  )
}
