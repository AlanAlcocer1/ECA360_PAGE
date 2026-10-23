import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { CloudUpload, RefreshCw, Trash2 } from 'lucide-react'
import { getApiBaseUrl } from '../../services/api'
import { getToken } from '../../lib/auth'

function formatEventLine(ev) {
  const t = ev?.type
  if (t === 'start') {
    return `Inicio · ${ev.file_count} archivo(s) · a WebP=${ev.convert_count ?? 0} · apply=${ev.apply} · borrar disco=${ev.delete_local}`
  }
  if (t === 'file') {
    const arrow = ev.new_key && ev.new_key !== ev.key ? ` → ${ev.new_key}` : ''
    const label =
      ev.action === 'converted'
        ? 'WebP'
        : ev.action === 'uploaded'
          ? 'subido'
          : ev.action === 'skip'
            ? 'ya en R2'
            : ev.action === 'convert'
              ? 'dry WebP'
              : 'dry-run'
    return `${label}  [${ev.index}/${ev.total}]  ${ev.key}${arrow}  (${ev.size_mb} MB)`
  }
  if (t === 'file_error') return `error  ${ev.key || ev.path}: ${ev.message}`
  if (t === 'upload_summary') {
    return `Subida lista · ok=${ev.uploaded} webp=${ev.converted ?? 0} skip=${ev.skipped} errores=${ev.errors}`
  }
  if (t === 'db') return `BD ${ev.action} · filas/bloques=${ev.rows}`
  if (t === 'delete') {
    return ev.action === 'deleted'
      ? `eliminado disco  [${ev.index}/${ev.total}]  ${ev.key}`
      : `no en R2, no se borro  ${ev.key}`
  }
  if (t === 'delete_summary') return `Disco liberado · borrados=${ev.deleted}`
  if (t === 'delete_skipped') return `⚠ ${ev.message}`
  if (t === 'delete_error') return `✗ delete ${ev.path}: ${ev.message}`
  if (t === 'error') return `ERROR: ${ev.message}`
  if (t === 'done') {
    const s = ev.stats || {}
    return `${ev.ok ? '✓' : '✗'} ${ev.message} · up=${s.uploaded ?? 0} webp=${s.converted ?? 0} skip=${s.skipped ?? 0} del=${s.deleted ?? 0} err=${s.errors ?? 0}`
  }
  return JSON.stringify(ev)
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` }
}

export default function AdminMigrateR2Page() {
  const [preview, setPreview] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [running, setRunning] = useState(false)
  const [deleteLocal, setDeleteLocal] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [lines, setLines] = useState([])
  const [progress, setProgress] = useState({ index: 0, total: 0 })
  const [jobMessage, setJobMessage] = useState('')
  const logRef = useRef(null)
  const eventCursor = useRef(0)
  const pollTimer = useRef(null)
  const toastOnFinish = useRef(false)

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true)
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/migrate-r2/preview`, {
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('preview failed')
      setPreview(await res.json())
    } catch {
      toast.error('No se pudo cargar el resumen de migración')
      setPreview(null)
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  const ingestJob = useCallback(
    (job, { replace = false } = {}) => {
      if (!job?.id && job?.status === 'idle') {
        setRunning(false)
        return
      }
      if (!job) return

      setDryRun(Boolean(job.dry_run))
      setJobMessage(job.message || '')
      if (job.progress) {
        setProgress({
          index: job.progress.index || 0,
          total: job.progress.total || 0,
        })
      }

      const events = job.events || []
      if (replace) {
        setLines(events.map(formatEventLine))
      } else if (events.length) {
        setLines((prev) => [...prev, ...events.map(formatEventLine)])
      }
      if (typeof job.event_count === 'number') {
        eventCursor.current = job.event_count
      }

      const busy = job.status === 'running'
      setRunning(busy)

      if (!busy && toastOnFinish.current && (job.status === 'done' || job.status === 'error')) {
        toastOnFinish.current = false
        if (job.ok) toast.success(job.dry_run ? 'Simulación terminada' : 'Migración terminada')
        else toast.error(job.message || 'Terminó con errores — revisa el log')
        loadPreview()
      }
    },
    [loadPreview],
  )

  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/admin/migrate-r2/status?since=${eventCursor.current}`,
        { headers: authHeaders() },
      )
      if (!res.ok) return
      const job = await res.json()
      ingestJob(job)
      if (job.status !== 'running') stopPolling()
    } catch {
      /* siguiente tick */
    }
  }, [ingestJob])

  const startPolling = useCallback(() => {
    stopPolling()
    pollOnce()
    pollTimer.current = setInterval(pollOnce, 1500)
  }, [pollOnce])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await loadPreview()
      try {
        const res = await fetch(`${getApiBaseUrl()}/admin/migrate-r2/status?since=0`, {
          headers: authHeaders(),
        })
        if (!res.ok || cancelled) return
        const job = await res.json()
        if (!job.id) return
        eventCursor.current = 0
        ingestJob(job, { replace: true })
        if (job.status === 'running') {
          toastOnFinish.current = true
          startPolling()
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
      stopPolling()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [lines])

  const runMigration = async ({ dry }) => {
    setConfirmOpen(false)
    toastOnFinish.current = true
    eventCursor.current = 0
    setLines([])
    setProgress({ index: 0, total: preview?.file_count || 0 })
    setDryRun(dry)
    setRunning(true)
    setJobMessage('Iniciando en el servidor…')

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/migrate-r2/run`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dry_run: dry,
          delete_local: !dry && deleteLocal,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.detail
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${res.status}`)
      }
      const started = await res.json()
      toast.success(started.message || 'Migración en background')
      setJobMessage(started.message || '')
      startPolling()
    } catch (e) {
      toast.error(e.message || 'No se pudo iniciar')
      setLines((prev) => [...prev, `ERROR: ${e.message || e}`])
      setRunning(false)
      toastOnFinish.current = false
    }
  }

  const pct =
    progress.total > 0 ? Math.min(100, Math.round((progress.index / progress.total) * 100)) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Migrar media a R2</h1>
        <p className="mt-1 text-sm text-muted">
          Corre en el servidor (background): puedes cerrar el navegador y al volver ves el progreso.
          Jpg/png → WebP; lo que ya está en R2 se salta al reintentar.
        </p>
      </div>

      <section className="border border-line bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Estado</h2>
          <button
            type="button"
            onClick={loadPreview}
            disabled={loadingPreview || running}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand disabled:opacity-40"
          >
            <RefreshCw size={14} className={loadingPreview ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {loadingPreview && !preview ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : preview ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">R2 configurado</dt>
              <dd
                className={
                  preview.r2_configured ? 'font-medium text-emerald-700' : 'font-medium text-red-600'
                }
              >
                {preview.r2_configured ? 'Sí' : 'No — revisa env en Coolify'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Bucket / público</dt>
              <dd className="break-all font-medium text-ink">
                {preview.r2_bucket || '—'}
                <br />
                <span className="text-xs font-normal text-muted">
                  {preview.r2_public_base_url || '—'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Archivos locales</dt>
              <dd className="font-medium text-ink">
                {preview.file_count} · ~{preview.total_mb} MB
                {preview.convert_count > 0 && (
                  <span className="mt-0.5 block text-xs font-normal text-muted">
                    {preview.convert_count} se convertirán a WebP (jpg/png)
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Job</dt>
              <dd className="font-medium text-ink">
                {running ? (
                  <span className="text-amber-700">En curso en el servidor…</span>
                ) : preview.job?.status && preview.job.status !== 'idle' ? (
                  <span className="capitalize">{preview.job.status}</span>
                ) : (
                  'Listo'
                )}
              </dd>
            </div>
          </dl>
        ) : null}

        {preview?.samples?.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium text-muted">
              Muestra (primeros {preview.samples.length})
            </p>
            <ul className="max-h-36 space-y-1 overflow-y-auto font-mono text-[11px] text-muted">
              {preview.samples.map((s) => (
                <li key={s.key}>
                  {s.convert ? `${s.key} → ${s.new_key}` : s.key} · {s.size_mb} MB
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="border border-line bg-white p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={deleteLocal}
            disabled={running}
            onChange={(e) => setDeleteLocal(e.target.checked)}
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Trash2 size={15} /> Eliminar del servidor al terminar
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Solo borra lo que ya está en R2. Con ~2000 archivos: migra primero sin borrar; borra en
              una segunda pasada.
            </span>
          </span>
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={running || !preview}
            onClick={() => runMigration({ dry: true })}
            className="border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface disabled:opacity-40"
          >
            Simular (dry-run)
          </button>
          <button
            type="button"
            disabled={running || !preview?.r2_configured || preview?.file_count === 0}
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-2 bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
          >
            <CloudUpload size={16} />
            Migrar a R2
          </button>
        </div>
      </section>

      {(running || lines.length > 0) && (
        <section className="border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Log {dryRun ? '(simulación)' : ''} {running ? '· background' : ''}
            </h2>
            {progress.total > 0 && (
              <span className="text-xs text-muted">
                {progress.index}/{progress.total} · {pct}%
              </span>
            )}
          </div>
          {jobMessage && <p className="mb-2 text-xs text-muted">{jobMessage}</p>}
          <div className="mb-3 h-2 overflow-hidden bg-surface">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${running && progress.total === 0 ? 5 : pct}%` }}
            />
          </div>
          <pre
            ref={logRef}
            className="max-h-[420px] overflow-auto bg-[#0e0e10] p-3 font-mono text-[11px] leading-relaxed text-[#e8e4df]"
          >
            {lines.join('\n') || (running ? 'Esperando eventos del servidor…' : '')}
          </pre>
        </section>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-line bg-white p-6 shadow-xl">
            <h3 className="font-display text-xl font-semibold text-ink">¿Ejecutar migración?</h3>
            <p className="mt-2 text-sm text-muted">
              Se procesarán <strong>{preview?.file_count ?? 0}</strong> archivo(s) (~
              {preview?.total_mb ?? 0} MB) en el servidor
              {preview?.convert_count > 0 && (
                <>
                  ; <strong>{preview.convert_count}</strong> a WebP
                </>
              )}
              . Puedes cerrar esta pestaña; al volver verás el log.
              {deleteLocal && (
                <span className="mt-2 block font-medium text-red-700">
                  También se eliminarán del disco al terminar sin errores.
                </span>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-sm text-muted hover:text-ink"
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                onClick={() => runMigration({ dry: false })}
              >
                Sí, migrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
