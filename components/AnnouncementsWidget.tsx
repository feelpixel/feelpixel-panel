'use client'

import { useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

interface Props {
  announcements: Announcement[]
  isAdmin: boolean
}

export function AnnouncementsWidget({ announcements: initial, isAdmin }: Props) {
  const [list, setList] = useState<Announcement[]>(initial)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (list.length === 0 && !isAdmin) return null

  function openCreate() {
    setEditingId(null)
    setTitle('')
    setContent('')
    setError('')
    setShowModal(true)
  }

  function openEdit(a: Announcement) {
    setEditingId(a.id)
    setTitle(a.title)
    setContent(a.content)
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setTitle('')
    setContent('')
    setError('')
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      setError('El título y el contenido son obligatorios.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()

    if (editingId) {
      const { data, error: err } = await supabase
        .from('announcements')
        .update({ title: title.trim(), content: content.trim() })
        .eq('id', editingId)
        .select()
        .single()
      if (err) { setError('Error al guardar. Intentá de nuevo.'); setSaving(false); return }
      setList(prev => prev.map(a => a.id === editingId ? data : a))
    } else {
      const { data, error: err } = await supabase
        .from('announcements')
        .insert({ title: title.trim(), content: content.trim() })
        .select()
        .single()
      if (err) { setError('Error al guardar. Intentá de nuevo.'); setSaving(false); return }
      setList(prev => [data, ...prev])
    }

    setSaving(false)
    closeModal()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error: err } = await supabase.from('announcements').delete().eq('id', id)
    if (!err) setList(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  return (
    <>
      {/* Widget */}
      {(list.length > 0 || isAdmin) && (
        <div className="mb-6 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Megaphone size={14} className="text-fp-cerulean" />
              <h2 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Novedades</h2>
            </div>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg bg-fp-punch-red/10 text-fp-punch-red font-semibold hover:bg-fp-punch-red/20 transition-colors"
              >
                <Plus size={12} />
                Nueva novedad
              </button>
            )}
          </div>

          {/* List */}
          {list.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400 dark:text-fp-text-tertiary">
              No hay novedades publicadas todavía.
            </div>
          ) : (
            <div>
              {list.map((a, idx) => (
                <div
                  key={a.id}
                  className={`px-5 py-4 ${idx < list.length - 1 ? 'border-b border-gray-50 dark:border-fp-border-dark' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">{a.title}</p>
                      <p className="text-sm text-gray-500 dark:text-fp-text-secondary mt-1 whitespace-pre-wrap">{a.content}</p>
                      <p className="text-[10px] text-gray-400 dark:text-fp-text-tertiary mt-2">{formatDate(a.created_at)}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(a)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        {deletingId === a.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="p-1.5 rounded-lg text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors"
                              title="Confirmar eliminación"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"
                              title="Cancelar"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(a.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
              <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                {editingId ? 'Editar novedad' : 'Nueva novedad'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <p className="text-xs text-fp-punch-red bg-fp-punch-red/10 px-3 py-2 rounded-lg">{error}</p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">
                  Título
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej: Reunión de equipo el viernes"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew placeholder-gray-300 dark:placeholder-fp-text-tertiary focus:outline-none focus:ring-2 focus:ring-fp-cerulean/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">
                  Contenido
                </label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Escribí el mensaje para el equipo..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew placeholder-gray-300 dark:placeholder-fp-text-tertiary focus:outline-none focus:ring-2 focus:ring-fp-cerulean/30 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-fp-border-dark">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm rounded-lg text-gray-500 dark:text-fp-text-secondary hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-fp-punch-red text-white font-medium hover:bg-fp-punch-red/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
