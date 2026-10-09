import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Copy,
  GripVertical,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Settings2,
  Upload,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BLOCK_TYPES, createBlock } from '../../lib/utils'
import { getApiBaseUrl, mediaUrl, uploadApi } from '../../services/api'
import BlockRenderer from '../blocks/BlockRenderer'
import clsx from 'clsx'

export default function BlockEditor({ blocks, onChange }) {
  const [selectedId, setSelectedId] = useState(null)
  const [preview, setPreview] = useState(false)
  const [showPalette, setShowPalette] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const selected = blocks.find((b) => b.id === selectedId) || null

  const updateBlocks = (next) => {
    onChange(next.map((b, i) => ({ ...b, position: i })))
  }

  const addBlock = (type) => {
    const block = createBlock(type)
    updateBlocks([...blocks, block])
    setSelectedId(block.id)
    setShowPalette(false)
  }

  const duplicateBlock = (id) => {
    const idx = blocks.findIndex((b) => b.id === id)
    if (idx < 0) return
    const copy = {
      ...structuredClone(blocks[idx]),
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    }
    const next = [...blocks]
    next.splice(idx + 1, 0, copy)
    updateBlocks(next)
    setSelectedId(copy.id)
  }

  const removeBlock = (id) => {
    updateBlocks(blocks.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const patchBlock = (id, patch) => {
    updateBlocks(
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              ...patch,
              content: { ...b.content, ...(patch.content || {}) },
              settings: { ...b.settings, ...(patch.settings || {}) },
            }
          : b,
      ),
    )
  }

  const onDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    updateBlocks(arrayMove(blocks, oldIndex, newIndex))
  }

  if (preview) {
    return (
      <div className="border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-medium">Vista previa</p>
          <button
            type="button"
            onClick={() => setPreview(false)}
            className="inline-flex items-center gap-2 text-sm text-brand"
          >
            <EyeOff size={16} /> Salir de vista previa
          </button>
        </div>
        <div className="p-6">
          <BlockRenderer blocks={blocks} />
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-sm font-medium">Constructor visual</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              <Eye size={14} /> Vista previa
            </button>
            <button
              type="button"
              onClick={() => setShowPalette((v) => !v)}
              className="inline-flex items-center gap-1.5 bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              <Plus size={14} /> Bloque
            </button>
          </div>
        </div>

        {showPalette && (
          <div className="grid grid-cols-2 gap-2 border-b border-line bg-surface p-3 sm:grid-cols-4">
            {BLOCK_TYPES.map((b) => (
              <button
                key={b.type}
                type="button"
                onClick={() => addBlock(b.type)}
                className="border border-line bg-white px-2 py-2 text-xs font-medium hover:border-brand hover:text-brand"
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="divide-y divide-line">
              {blocks.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  Agrega bloques o elige una plantilla.
                </p>
              )}
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  selected={selectedId === block.id}
                  onSelect={() => setSelectedId(block.id)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onRemove={() => removeBlock(block.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <aside className="border border-line bg-white">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Settings2 size={16} className="text-brand" />
          <p className="text-sm font-medium">Configuración</p>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {!selected ? (
            <p className="text-sm text-muted">Selecciona un bloque para editarlo.</p>
          ) : (
            <BlockSettings
              block={selected}
              onChange={(patch) => patchBlock(selected.id, patch)}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

function SortableBlock({ block, selected, onSelect, onDuplicate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const label = BLOCK_TYPES.find((b) => b.type === block.type)?.label || block.type

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex items-start gap-2 px-3 py-3',
        selected && 'bg-brand/5',
        isDragging && 'z-10 bg-white shadow-lg',
      )}
    >
      <button
        type="button"
        className="mt-1 cursor-grab touch-none text-muted hover:text-ink"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{label}</p>
        <p className="mt-1 line-clamp-2 text-sm text-muted">
          {previewText(block)}
        </p>
      </button>
      <div className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button type="button" onClick={onDuplicate} className="rounded p-1.5 text-muted hover:bg-surface" title="Duplicar">
          <Copy size={14} />
        </button>
        <button type="button" onClick={onRemove} className="rounded p-1.5 text-muted hover:bg-surface hover:text-brand" title="Eliminar">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function previewText(block) {
  const c = block.content || {}
  return (
    c.title ||
    c.text ||
    c.subtitle ||
    c.label ||
    c.caption ||
    c.url ||
    (c.images?.length ? `${c.images.length} imágenes` : '') ||
    (c.items?.length ? `${c.items.length} elementos` : '') ||
    block.type
  )
}

function Field({ label, children }) {
  return (
    <label className="mb-3 block text-xs font-medium text-ink">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function inputClass() {
  return 'w-full border border-line px-3 py-2 text-sm outline-none focus:border-brand'
}

function UploadButton({ onUploaded, accept = 'image/*,video/*', label = 'Subir archivo' }) {
  const [busy, setBusy] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const { data } = await uploadApi.upload(file)
      onUploaded(data)
      toast.success('Archivo subido')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al subir')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 border border-line px-3 py-2 text-xs font-medium hover:bg-surface">
      <Upload size={14} />
      {busy ? 'Subiendo...' : label}
      <input type="file" accept={accept} className="hidden" onChange={onFile} disabled={busy} />
    </label>
  )
}

function BlockSettings({ block, onChange }) {
  const c = block.content || {}
  const s = block.settings || {}
  const setContent = (patch) => onChange({ content: patch })
  const setSettings = (patch) => onChange({ settings: patch })

  // Ingest es endpoint del API (Coolify), no del front (Cloudflare)
  const ingestCode = (s.ingest_code || '').trim().toLowerCase()
  const apiBase = getApiBaseUrl().replace(/\/+$/, '')
  const ingestUrl = ingestCode ? `${apiBase}/ingest/${ingestCode}` : ''

  const copyIngestUrl = async () => {
    if (!ingestUrl) return
    try {
      await navigator.clipboard.writeText(ingestUrl)
      toast.success('URL copiada')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  switch (block.type) {
    case 'hero':
      return (
        <>
          <Field label="Título">
            <input className={inputClass()} value={c.title || ''} onChange={(e) => setContent({ title: e.target.value })} />
          </Field>
          <Field label="Subtítulo">
            <input className={inputClass()} value={c.subtitle || ''} onChange={(e) => setContent({ subtitle: e.target.value })} />
          </Field>
          <Field label="Imagen de fondo">
            <div className="space-y-2">
              {c.image && <img src={mediaUrl(c.image)} alt="" className="h-24 w-full object-cover" />}
              <UploadButton accept="image/*" label="Subir imagen" onUploaded={(m) => setContent({ image: m.url })} />
            </div>
          </Field>
          <Field label="Alineación">
            <select className={inputClass()} value={s.align || 'center'} onChange={(e) => setSettings({ align: e.target.value })}>
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
            </select>
          </Field>
          <Field label="Altura">
            <select className={inputClass()} value={s.height || 'large'} onChange={(e) => setSettings({ height: e.target.value })}>
              <option value="medium">Media</option>
              <option value="large">Grande</option>
            </select>
          </Field>
        </>
      )

    case 'title':
    case 'subtitle':
    case 'paragraph':
    case 'quote':
      return (
        <>
          <Field label="Texto">
            <textarea
              rows={block.type === 'paragraph' ? 5 : 3}
              className={inputClass()}
              value={c.text || ''}
              onChange={(e) => setContent({ text: e.target.value })}
            />
          </Field>
          {block.type === 'quote' && (
            <Field label="Autor">
              <input className={inputClass()} value={c.author || ''} onChange={(e) => setContent({ author: e.target.value })} />
            </Field>
          )}
          {block.type === 'title' && (
            <Field label="Tamaño">
              <select className={inputClass()} value={s.size || 'xl'} onChange={(e) => setSettings({ size: e.target.value })}>
                <option value="sm">Pequeño</option>
                <option value="md">Medio</option>
                <option value="lg">Grande</option>
                <option value="xl">Extra</option>
              </select>
            </Field>
          )}
          <Field label="Alineación">
            <select className={inputClass()} value={s.align || 'left'} onChange={(e) => setSettings({ align: e.target.value })}>
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </Field>
        </>
      )

    case 'image':
      return (
        <>
          <Field label="Imagen">
            <div className="space-y-2">
              {c.url && <img src={mediaUrl(c.url)} alt="" className="h-28 w-full object-cover" />}
              <UploadButton accept="image/*" onUploaded={(m) => setContent({ url: m.url, alt: m.original_name })} />
            </div>
          </Field>
          <Field label="Caption">
            <input className={inputClass()} value={c.caption || ''} onChange={(e) => setContent({ caption: e.target.value })} />
          </Field>
          <Field label="Alt">
            <input className={inputClass()} value={c.alt || ''} onChange={(e) => setContent({ alt: e.target.value })} />
          </Field>
        </>
      )

    case 'gallery':
      return (
        <>
          <Field label="Columnas">
            <input
              type="number"
              min={2}
              max={4}
              className={inputClass()}
              value={c.columns || 3}
              onChange={(e) => setContent({ columns: Number(e.target.value) })}
            />
          </Field>
          <Field label="Imágenes">
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1">
                {(c.images || []).map((img, i) => (
                  <div key={i} className="relative">
                    <img src={mediaUrl(typeof img === 'string' ? img : img.url)} alt="" className="aspect-square object-cover" />
                    <button
                      type="button"
                      className="absolute right-0 top-0 bg-brand px-1 text-[10px] text-white"
                      onClick={() =>
                        setContent({
                          images: (c.images || []).filter((_, idx) => idx !== i),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <UploadButton
                accept="image/*"
                label="Agregar imagen"
                onUploaded={(m) => setContent({ images: [...(c.images || []), { url: m.url, alt: '' }] })}
              />
            </div>
          </Field>
        </>
      )

    case 'video_local':
      return (
        <>
          <Field label="Video">
            <div className="space-y-2">
              {c.url && <p className="truncate text-xs text-muted">{c.url}</p>}
              <UploadButton accept="video/mp4,video/webm,video/quicktime,.mov,.mp4,.webm" label="Subir video" onUploaded={(m) => setContent({ url: m.url })} />
            </div>
          </Field>
          <Field label="Poster">
            <UploadButton accept="image/*" label="Subir poster" onUploaded={(m) => setContent({ poster: m.url })} />
          </Field>
          <Field label="Caption">
            <input className={inputClass()} value={c.caption || ''} onChange={(e) => setContent({ caption: e.target.value })} />
          </Field>
        </>
      )

    case 'video_youtube':
      return (
        <>
          <Field label="URL de YouTube">
            <input className={inputClass()} value={c.url || ''} onChange={(e) => setContent({ url: e.target.value })} />
          </Field>
          <Field label="Caption">
            <input className={inputClass()} value={c.caption || ''} onChange={(e) => setContent({ caption: e.target.value })} />
          </Field>
        </>
      )

    case 'carousel':
      return (
        <>
          <Field label="Código de recepción (URL sencilla)">
            <input
              className={inputClass()}
              value={s.ingest_code || ''}
              placeholder="ej: boda-ana"
              onChange={(e) =>
                setSettings({
                  ingest_code: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9\-_]/g, '')
                    .slice(0, 64),
                })
              }
            />
            <p className="mt-1 text-xs text-muted">
              Guarda el evento después de poner el código. El otro sistema hará POST (fotos o videos) a
              la API (<code className="text-[11px]">api.eca360.com.mx</code>), no al front.
            </p>
          </Field>
          {ingestUrl ? (
            <Field label="URL para el otro sistema">
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate border border-line bg-surface px-2 py-2 text-xs">
                  {ingestUrl}
                </code>
                <button
                  type="button"
                  onClick={copyIngestUrl}
                  className="inline-flex items-center gap-1 border border-line px-2 py-2 text-xs hover:border-brand"
                >
                  <Copy size={12} />
                  Copiar
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">
                Fotos o videos: curl -F &quot;file=@foto.jpg&quot; {ingestUrl}
              </p>
            </Field>
          ) : null}
          <Field label="Elementos del carrusel (Cover Flow 3D)">
            <div className="space-y-2">
              {(c.items || []).map((item, i) => (
                <div key={i} className="flex items-center gap-2 border border-line p-2">
                  <span className="truncate text-xs">
                    {item.type}: {item.url}
                  </span>
                  <button
                    type="button"
                    className="ml-auto text-brand"
                    onClick={() => setContent({ items: (c.items || []).filter((_, idx) => idx !== i) })}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <UploadButton
                accept="image/*"
                label="Agregar imagen"
                onUploaded={(m) =>
                  setContent({ items: [...(c.items || []), { type: 'image', url: m.url }] })
                }
              />
              <UploadButton
                accept="video/mp4,video/webm,video/quicktime,.mov,.mp4,.webm"
                label="Agregar video"
                onUploaded={(m) =>
                  setContent({
                    items: [...(c.items || []), { type: 'video', url: m.url, poster: m.thumbnail_url }],
                  })
                }
              />
            </div>
          </Field>
        </>
      )

    case 'two_columns':
      return (
        <>
          <Field label="Columna izquierda">
            <textarea rows={4} className={inputClass()} value={c.left || ''} onChange={(e) => setContent({ left: e.target.value })} />
          </Field>
          <Field label="Columna derecha">
            <textarea rows={4} className={inputClass()} value={c.right || ''} onChange={(e) => setContent({ right: e.target.value })} />
          </Field>
        </>
      )

    case 'button':
      return (
        <>
          <Field label="Texto">
            <input className={inputClass()} value={c.label || ''} onChange={(e) => setContent({ label: e.target.value })} />
          </Field>
          <Field label="URL">
            <input className={inputClass()} value={c.url || ''} onChange={(e) => setContent({ url: e.target.value })} />
          </Field>
          <Field label="Estilo">
            <select className={inputClass()} value={c.style || 'primary'} onChange={(e) => setContent({ style: e.target.value })}>
              <option value="primary">Primario</option>
              <option value="secondary">Secundario</option>
            </select>
          </Field>
        </>
      )

    case 'list':
      return (
        <>
          <Field label="Elementos (uno por línea)">
            <textarea
              rows={5}
              className={inputClass()}
              value={(c.items || []).join('\n')}
              onChange={(e) => setContent({ items: e.target.value.split('\n') })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!c.ordered}
              onChange={(e) => setContent({ ordered: e.target.checked })}
            />
            Lista numerada
          </label>
        </>
      )

    case 'table':
      return (
        <>
          <Field label="Encabezados (separados por |)">
            <input
              className={inputClass()}
              value={(c.headers || []).join(' | ')}
              onChange={(e) =>
                setContent({ headers: e.target.value.split('|').map((x) => x.trim()) })
              }
            />
          </Field>
          <Field label="Filas (celdas con |, filas con salto de línea)">
            <textarea
              rows={5}
              className={inputClass()}
              value={(c.rows || []).map((r) => r.join(' | ')).join('\n')}
              onChange={(e) =>
                setContent({
                  rows: e.target.value
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => line.split('|').map((x) => x.trim())),
                })
              }
            />
          </Field>
        </>
      )

    case 'spacer':
      return (
        <Field label="Altura (px)">
          <input
            type="number"
            className={inputClass()}
            value={c.height || 40}
            onChange={(e) => setContent({ height: Number(e.target.value) })}
          />
        </Field>
      )

    case 'divider':
      return <p className="text-sm text-muted">Separador visual sin opciones extra.</p>

    default:
      return <p className="text-sm text-muted">Sin configuración específica.</p>
  }
}
