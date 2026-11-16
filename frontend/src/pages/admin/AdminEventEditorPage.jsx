import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Save, Upload } from 'lucide-react'
import { eventsApi, mediaUrl, uploadApi } from '../../services/api'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/utils'
import BlockEditor from '../../components/admin/BlockEditor'

export default function AdminEventEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'nuevo'
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    cover_image: '',
    event_date: '',
    location: '',
    template: '',
    status: 'draft',
    seo_title: '',
    seo_description: '',
    og_image: '',
    blocks: [],
  })

  useEffect(() => {
    eventsApi.templates().then(({ data }) => setTemplates(data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    eventsApi
      .getById(id)
      .then(({ data }) => {
        setForm({
          title: data.title || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          cover_image: data.cover_image || '',
          event_date: toDatetimeLocalValue(data.event_date),
          location: data.location || '',
          template: data.template || '',
          status: data.status || 'draft',
          seo_title: data.seo_title || '',
          seo_description: data.seo_description || '',
          og_image: data.og_image || '',
          blocks: (data.blocks || []).map((b) => ({
            ...b,
            id: b.id ? String(b.id) : `tmp_${b.position}`,
          })),
        })
      })
      .catch(() => {
        toast.error('Evento no encontrado')
        navigate('/admin/eventos')
      })
      .finally(() => setLoading(false))
  }, [id, isNew, navigate])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const applyTemplate = async (key) => {
    if (!key) return
    const tpl = templates.find((t) => t.key === key)
    setField('template', key)
    if (tpl?.excerpt && !form.excerpt) setField('excerpt', tpl.excerpt)
    // Fetch blocks by creating a temporary structure from API templates endpoint content
    // Backend returns label/excerpt; blocks come when creating. Load from known keys via create preview:
    try {
      // Use client-side template mirror by requesting create with dry approach —
      // Instead call a lightweight local map via creating draft? Better: hit create with title then delete — no.
      // We'll embed template blocks from a second request: eventsApi doesn't expose blocks-only.
      // Workaround: apply by posting then... Actually backend get_template is used on create when blocks empty.
      // For editor UX, call create with temporary? Too heavy.
      // Simplest: store templates with blocks in frontend helper.
      const { default: localTemplates } = await import('../../lib/templates')
      const blocks = localTemplates[key] || []
      setForm((prev) => ({
        ...prev,
        template: key,
        excerpt: prev.excerpt || tpl?.excerpt || '',
        blocks: blocks.map((b, i) => ({
          ...b,
          id: `tmp_${Date.now()}_${i}`,
          position: i,
        })),
      }))
      toast.success(`Plantilla "${tpl?.label || key}" aplicada`)
    } catch {
      setField('template', key)
      toast.success('Plantilla seleccionada (bloques al guardar si está vacío)')
    }
  }

  const uploadCover = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { data } = await uploadApi.upload(file)
      setForm((prev) => ({
        ...prev,
        cover_image: data.url,
        og_image: prev.og_image || data.url,
      }))
      toast.success('Portada subida')
    } catch {
      toast.error('Error al subir portada')
    }
  }

  const save = async (statusOverride) => {
    if (!form.title.trim()) {
      toast.error('El título es obligatorio')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      excerpt: form.excerpt || null,
      cover_image: form.cover_image || null,
      event_date: fromDatetimeLocalValue(form.event_date),
      location: form.location || null,
      template: form.template || null,
      status: statusOverride || form.status,
      seo_title: form.seo_title || form.title,
      seo_description: form.seo_description || form.excerpt || null,
      og_image: form.og_image || form.cover_image || null,
      blocks: form.blocks.map((b, i) => ({
        type: b.type,
        position: i,
        content: b.content || {},
        settings: b.settings || {},
      })),
    }

    try {
      if (isNew) {
        const { data } = await eventsApi.create(payload)
        toast.success('Evento creado')
        navigate(`/admin/eventos/${data.id}`, { replace: true })
      } else {
        await eventsApi.update(id, payload)
        toast.success('Evento guardado')
        setField('status', payload.status)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="skeleton h-40" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/eventos" className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand">
            <ArrowLeft size={14} /> Eventos
          </Link>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {isNew ? 'Nuevo evento' : 'Editar evento'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save('draft')}
            className="border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-surface disabled:opacity-60"
          >
            Guardar borrador
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save('published')}
            className="inline-flex items-center gap-2 bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Publicar'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="border border-line bg-white p-4">
            <label className="block text-xs font-medium text-muted">Título</label>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className="mt-1 w-full border-0 border-b border-line px-0 py-2 font-display text-2xl outline-none focus:border-brand"
              placeholder="Nombre del evento"
            />
            <label className="mt-4 block text-xs font-medium text-muted">Extracto</label>
            <textarea
              rows={2}
              value={form.excerpt}
              onChange={(e) => setField('excerpt', e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="Resumen corto..."
            />
          </div>

          <BlockEditor blocks={form.blocks} onChange={(blocks) => setField('blocks', blocks)} />
        </div>

        <aside className="space-y-4">
          <div className="border border-line bg-white p-4">
            <h3 className="text-sm font-semibold">Publicación</h3>
            <label className="mt-3 block text-xs text-muted">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="hidden">Oculto</option>
            </select>
            <label className="mt-3 block text-xs text-muted">Slug</label>
            <input
              value={form.slug}
              onChange={(e) => setField('slug', e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder="auto-generado"
            />
          </div>

          <div className="border border-line bg-white p-4">
            <h3 className="text-sm font-semibold">Plantilla</h3>
            <select
              value={form.template}
              onChange={(e) => applyTemplate(e.target.value)}
              className="mt-3 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Sin plantilla</option>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-muted">Al elegir una plantilla se generan los bloques automáticamente.</p>
          </div>

          <div className="border border-line bg-white p-4">
            <h3 className="text-sm font-semibold">Detalles</h3>
            <label className="mt-3 block text-xs text-muted">Fecha del evento</label>
            <input
              type="datetime-local"
              value={form.event_date}
              onChange={(e) => setField('event_date', e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <label className="mt-3 block text-xs text-muted">Ubicación</label>
            <input
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <label className="mt-3 block text-xs text-muted">Portada</label>
            {form.cover_image && (
              <img src={mediaUrl(form.cover_image)} alt="" className="mt-2 aspect-video w-full object-cover" />
            )}
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 border border-line px-3 py-2 text-xs font-medium hover:bg-surface">
              <Upload size={14} /> Subir portada
              <input type="file" accept="image/*" className="hidden" onChange={uploadCover} />
            </label>
          </div>

          <div className="border border-line bg-white p-4">
            <h3 className="text-sm font-semibold">SEO</h3>
            <label className="mt-3 block text-xs text-muted">SEO Title</label>
            <input
              value={form.seo_title}
              onChange={(e) => setField('seo_title', e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <label className="mt-3 block text-xs text-muted">SEO Description</label>
            <textarea
              rows={3}
              value={form.seo_description}
              onChange={(e) => setField('seo_description', e.target.value)}
              className="mt-1 w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
