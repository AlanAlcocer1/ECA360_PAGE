import { useEffect, useState } from 'react'
import { Check, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { commentsApi } from '../../services/api'
import { formatDate } from '../../lib/utils'
import { useDebounce } from '../../hooks/useInfiniteScroll'

export default function AdminCommentsPage() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const debounced = useDebounce(search)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await commentsApi.adminList({
        page: 1,
        page_size: 100,
        search: debounced || undefined,
      })
      setItems(data.items)
    } catch {
      toast.error('Error al cargar comentarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [debounced])

  const remove = async (id) => {
    if (!confirm('¿Eliminar comentario?')) return
    try {
      await commentsApi.remove(id)
      toast.success('Eliminado')
      load()
    } catch {
      toast.error('No se pudo eliminar')
    }
  }

  const toggle = async (comment) => {
    try {
      if (comment.approved) {
        await commentsApi.disable(comment.id)
        toast.success('Comentario desactivado')
      } else {
        await commentsApi.approve(comment.id)
        toast.success('Comentario aprobado')
      }
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Comentarios</h1>
      <p className="mt-1 text-sm text-muted">Modera, busca y elimina comentarios.</p>

      <div className="relative mt-6 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o texto..."
          className="w-full border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="mt-6 space-y-3">
        {loading && <div className="skeleton h-24" />}
        {!loading && items.length === 0 && (
          <p className="border border-line bg-white px-4 py-8 text-center text-sm text-muted">
            No hay comentarios.
          </p>
        )}
        {items.map((c) => (
          <article key={c.id} className="border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted">
                  {c.event_title || `Evento #${c.event_id}`} · {formatDate(c.created_at)}
                  {c.rating != null ? ` · ${c.rating}/5 ★` : ''}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  c.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {c.approved ? 'Activo' : 'Desactivado'}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-ink/80">{c.content}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => toggle(c)}
                className="inline-flex items-center gap-1 border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
              >
                {c.approved ? (
                  <>
                    <X size={12} /> Desactivar
                  </>
                ) : (
                  <>
                    <Check size={12} /> Aprobar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="inline-flex items-center gap-1 border border-line px-3 py-1.5 text-xs font-medium text-brand hover:bg-surface"
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
