import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Download, Play, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getApiBaseUrl, mediaUrl } from '../../services/api'

function itemSrc(item) {
  return mediaUrl(item.url || item.src)
}

function itemThumb(item) {
  if (item.type === 'video' && item.poster) return mediaUrl(item.poster)
  return itemSrc(item)
}

/** Nombres que manda la cabina/ingest — no sirven como nombre de descarga. */
const GENERIC_STEM =
  /^(processed|output|video|final|export|clip|movie|render|file|media|thumb|thumbnail|poster|preview)$/i

function fileName(item, i, { asPng = false } = {}) {
  const fallback = item.type === 'video' ? `video-${i + 1}` : `foto-${i + 1}`
  let raw = item.alt || item.caption || ''
  let base = String(raw).replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim()
  base = base.replace(/\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i, '')
  if (!base || GENERIC_STEM.test(base)) base = fallback

  if (item.type === 'video') {
    const url = item.url || item.src || ''
    const extMatch = url.match(/\.(mp4|mov|webm)(\?|$)/i)
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.mp4'
    return `${base}${ext}`
  }
  return `${base}${asPng ? '.png' : '.webp'}`
}

function isProbablyMobile() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1
}

/** Fotos → API PNG. Videos → proxy API (evita CORS de R2 en el celular). */
function downloadUrlFor(item, index = 0) {
  const pathOrUrl = item.url || item.src || ''
  const api = getApiBaseUrl()
  if (item.type === 'video') {
    const params = new URLSearchParams({ url: pathOrUrl })
    const name = fileName(item, index)
    if (name) params.set('filename', name)
    return `${api}/download/file?${params.toString()}`
  }
  const params = new URLSearchParams({ url: pathOrUrl })
  const stem = fileName(item, index, { asPng: true }).replace(/\.png$/i, '')
  if (stem) params.set('filename', stem)
  return `${api}/download?${params.toString()}`
}

/** Descarga por URL: el navegador streamea al toque (foto o video). */
function triggerUrlDownload(url, name) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function saveOne(item, index) {
  const name = fileName(item, index, { asPng: item.type !== 'video' })
  triggerUrlDownload(downloadUrlFor(item, index), name)
  return 'download'
}

/**
 * Galería tipo álbum: ver, seleccionar y descargar.
 * Masivo sin ZIP: cola secuencial; en móvil pide un toque por archivo
 * porque Chrome/Safari bloquean varias descargas automáticas.
 */
export default function MediaGalleryPicker({
  open,
  items = [],
  initialIndex = 0,
  startInSelect = false,
  onClose,
}) {
  const list = useMemo(
    () => (items || []).filter((it) => it.url || it.src),
    [items],
  )
  const [selected, setSelected] = useState(() => new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [preview, setPreview] = useState(initialIndex)
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState(null) // { indexes, cursor, ok, fail }
  const swipeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setPreview(Math.min(Math.max(0, initialIndex), Math.max(0, list.length - 1)))
    setSelected(new Set())
    setSelectMode(Boolean(startInSelect))
    setBusy(false)
    setQueue(null)
  }, [open, initialIndex, list.length, startInSelect])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('eca-gallery-open')
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (queue) {
          setQueue(null)
          return
        }
        if (selectMode) {
          setSelectMode(false)
          setSelected(new Set())
        } else {
          onClose?.()
        }
      }
      if (selectMode || queue) return
      if (e.key === 'ArrowLeft') setPreview((p) => Math.max(0, p - 1))
      if (e.key === 'ArrowRight') setPreview((p) => Math.min(list.length - 1, p + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.body.classList.remove('eca-gallery-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, selectMode, list.length, queue])

  if (!open || !list.length) return null

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(list.map((_, i) => i)))
  const clearSel = () => setSelected(new Set())

  const finishQueue = (ok, fail) => {
    setQueue(null)
    setBusy(false)
    if (ok && !fail) {
      toast.success(ok === 1 ? 'Descarga lista' : `${ok} archivos descargados`)
    } else if (ok && fail) {
      toast.success(`${ok} ok · ${fail} no se pudieron`)
    } else {
      toast.error('No se pudo descargar. Prueba de nuevo o una por una.')
    }
  }

  /** Desktop / poca cantidad: baja sola con pausa. Móvil o muchas: cola con toque. */
  const downloadSelected = async () => {
    const indexes = selectMode ? [...selected].sort((a, b) => a - b) : [preview]
    if (!indexes.length) {
      toast.error('Selecciona al menos una')
      return
    }

    const mobile = isProbablyMobile()
    const needsTapQueue = mobile && indexes.length > 1

    if (needsTapQueue) {
      setBusy(true)
      setQueue({ indexes, cursor: 0, ok: 0, fail: 0 })
      return
    }

    setBusy(true)
    let ok = 0
    let fail = 0
    try {
      for (let n = 0; n < indexes.length; n += 1) {
        const i = indexes[n]
        try {
          saveOne(list[i], i)
          ok += 1
        } catch {
          fail += 1
        }
        if (n < indexes.length - 1) {
          await new Promise((r) => setTimeout(r, mobile ? 1400 : 700))
        }
      }
    } finally {
      finishQueue(ok, fail)
    }
  }

  const downloadQueueNext = () => {
    if (!queue) return
    const { indexes, cursor, ok, fail } = queue
    if (cursor >= indexes.length) {
      finishQueue(ok, fail)
      return
    }
    const i = indexes[cursor]
    let nextOk = ok
    let nextFail = fail
    try {
      saveOne(list[i], i)
      nextOk += 1
    } catch {
      nextFail += 1
      toast.error(`Falló ${cursor + 1}/${indexes.length}`)
    }
    const nextCursor = cursor + 1
    if (nextCursor >= indexes.length) {
      finishQueue(nextOk, nextFail)
      return
    }
    setQueue({ indexes, cursor: nextCursor, ok: nextOk, fail: nextFail })
    setBusy(true)
  }

  const current = list[preview]
  const queueActive = Boolean(queue)
  const queueItem = queueActive ? list[queue.indexes[queue.cursor]] : null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <header className="flex shrink-0 items-center gap-2 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {selectMode
                ? `${selected.size} seleccionadas`
                : `Galería · ${preview + 1} / ${list.length}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectMode((v) => !v)
              if (selectMode) clearSel()
            }}
            className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20"
          >
            {selectMode ? 'Cancelar' : 'Seleccionar'}
          </button>
        </header>

        {!selectMode && current && (
          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2"
            onPointerDown={(e) => {
              if (e.button != null && e.button !== 0) return
              swipeRef.current = { x: e.clientX, id: e.pointerId }
            }}
            onPointerUp={(e) => {
              const start = swipeRef.current
              swipeRef.current = null
              if (!start || start.id !== e.pointerId) return
              const dx = e.clientX - start.x
              if (Math.abs(dx) < 48) return
              if (dx < 0) setPreview((p) => Math.min(list.length - 1, p + 1))
              else setPreview((p) => Math.max(0, p - 1))
            }}
          >
            {current.type === 'video' ? (
              <video
                key={itemSrc(current)}
                src={itemSrc(current)}
                poster={current.poster ? mediaUrl(current.poster) : undefined}
                controls
                playsInline
                className="max-h-full max-w-full rounded-lg bg-black"
              />
            ) : (
              <img
                src={itemSrc(current)}
                alt={current.alt || ''}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            )}
          </div>
        )}

        <div
          className={`border-t border-white/10 bg-black ${
            selectMode ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[38vh] overflow-y-auto'
          }`}
        >
          <div className="grid grid-cols-3 gap-px bg-white/10 sm:grid-cols-4">
            {list.map((item, i) => {
              const isOn = selectMode ? selected.has(i) : preview === i
              return (
                <button
                  key={`${itemSrc(item)}-${i}`}
                  type="button"
                  onClick={() => (selectMode ? toggle(i) : setPreview(i))}
                  className={`relative aspect-square overflow-hidden bg-neutral-800 ${
                    isOn && !selectMode ? 'ring-2 ring-inset ring-white' : ''
                  }`}
                >
                  <img
                    src={itemThumb(item)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {item.type === 'video' && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 p-0.5">
                      <Play size={10} fill="currentColor" />
                    </span>
                  )}
                  {selectMode && (
                    <span
                      className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        selected.has(i)
                          ? 'border-brand bg-brand text-white'
                          : 'border-white/80 bg-black/30'
                      }`}
                    >
                      {selected.has(i) ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-3 sm:px-4">
          {selectMode ? (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded-full bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={clearSel}
                  className="rounded-full bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
                >
                  Ninguna
                </button>
              </div>
              <button
                type="button"
                disabled={Boolean(busy) || selected.size === 0}
                onClick={downloadSelected}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Download size={16} />
                {busy && !queue ? 'Preparando…' : `Descargar (${selected.size})`}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-white/50">Toca miniaturas · Seleccionar para varias</p>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={downloadSelected}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
              >
                <Download size={16} />
                {busy && !queue ? '…' : 'Descargar esta'}
              </button>
            </>
          )}
        </footer>

        {/* Cola móvil: un toque = un gesto de usuario → el navegador permite la descarga */}
        {queueActive && (
          <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/70 p-4 sm:items-center">
            <div className="w-full max-w-sm border border-white/15 bg-[#141416] p-5 text-white shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">
                {queue.cursor + 1} de {queue.indexes.length}
              </p>
              <p className="mt-2 font-display text-xl font-semibold">
                {queueItem?.type === 'video' ? 'Video listo para guardar' : 'Foto lista para guardar'}
              </p>
              <p className="mt-2 text-sm text-white/60">Ve guardando uno por uno.</p>
              {queueItem && (
                <div className="mt-4 overflow-hidden bg-black/40">
                  <img
                    src={itemThumb(queueItem)}
                    alt=""
                    className="mx-auto max-h-40 object-contain"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={downloadQueueNext}
                className="mt-5 flex w-full items-center justify-center gap-2 bg-brand px-4 py-3.5 text-sm font-semibold text-white"
              >
                <Download size={16} />
                {queue.cursor === 0 ? 'Guardar esta' : 'Guardar siguiente'}
              </button>
              <button
                type="button"
                className="mt-2 w-full py-2 text-sm text-white/50 hover:text-white"
                onClick={() => finishQueue(queue.ok, queue.fail + (queue.indexes.length - queue.cursor))}
              >
                Cancelar cola
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
