import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { settingsApi, mediaUrl } from '../services/api'

export const DEFAULT_SETTINGS = {
  site_name: 'ECA MID',
  logo_url: null,
  favicon_url: null,
  hero_eyebrow: 'ECA360',
  hero_title: 'Eventos que se cuentan en imágenes',
  hero_subtitle: 'Explora galerías, videos y momentos de bodas, XV años, graduaciones y más.',
  footer_text: 'Historias visuales de eventos inolvidables. Bodas, XV años, graduaciones y más.',
  color_brand: '#C1121F',
  color_brand_dark: '#9B0E18',
  color_ink: '#0A0A0A',
  color_surface: '#F5F5F5',
  seo_title: 'ECA360 Eventos — Historias que se viven',
  seo_description: 'Blog de eventos ECA360: bodas, XV años, graduaciones y eventos corporativos.',
  public_site_url: 'https://eca360.com.mx',
}

const SiteSettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  loading: true,
  refresh: async () => {},
  setSettings: () => {},
})

function applyTheme(settings) {
  const root = document.documentElement
  root.style.setProperty('--color-brand', settings.color_brand || DEFAULT_SETTINGS.color_brand)
  root.style.setProperty('--color-brand-dark', settings.color_brand_dark || DEFAULT_SETTINGS.color_brand_dark)
  root.style.setProperty('--color-brand-light', settings.color_brand || DEFAULT_SETTINGS.color_brand)
  root.style.setProperty('--color-ink', settings.color_ink || DEFAULT_SETTINGS.color_ink)
  root.style.setProperty('--color-surface', settings.color_surface || DEFAULT_SETTINGS.color_surface)

  const favicon = document.querySelector('link[rel="icon"]')
  if (favicon && settings.favicon_url) {
    favicon.href = mediaUrl(settings.favicon_url)
  }
}

export function SiteSettingsProvider({ children }) {
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const setSettings = useCallback((next) => {
    setSettingsState(next)
    applyTheme(next)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { data } = await settingsApi.get()
      setSettings(data)
    } catch {
      applyTheme(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [setSettings])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ settings, loading, refresh, setSettings }),
    [settings, loading, refresh, setSettings],
  )

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}

export function BrandMark({ className = '', nameClassName = '', showName = true, name: nameProp }) {
  const { settings } = useSiteSettings()
  const name = nameProp || settings.site_name || 'ECA MID'

  if (settings.logo_url) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src={mediaUrl(settings.logo_url)}
          alt={name}
          className="h-9 w-auto max-w-[160px] object-contain"
        />
        {showName && nameClassName.includes('force-name') ? (
          <span className={nameClassName}>{name}</span>
        ) : null}
      </span>
    )
  }

  // Split last digits/word for accent if name looks like ECA360
  const match = name.match(/^(.*?)(\d+)$/)
  const left = match ? match[1] : name
  const right = match ? match[2] : ''

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm">
        {(left || name).charAt(0).toUpperCase()}
      </span>
      {showName && (
        <span className={`font-display text-2xl font-semibold tracking-tight text-ink ${nameClassName}`}>
          {left}
          {right ? <span className="text-brand">{right}</span> : null}
        </span>
      )}
    </span>
  )
}
