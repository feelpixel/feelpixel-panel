'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { AccessDenied } from '@/components/AccessDenied'
import { createClient } from '@/lib/supabase/client'
import {
  Plus,
  Search,
  Users,
  Globe,
  Mail,
  Phone,
  Instagram,
  Linkedin,
  FolderOpen,
  ExternalLink,
  X,
  ChevronDown,
  Building2,
  StickyNote,
  FolderSync,
  Loader2,
} from 'lucide-react'

// ─── Tipos ──────────────────────────────────────────────────────────────

type Client = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
  instagram_url: string | null
  linkedin_url: string | null
  drive_folder_id: string | null
  drive_fee_folder_id: string | null
  created_at: string
  // virtual — lo calculamos aparte
  project_count?: number
}

type FormState = {
  name: string
  company: string
  email: string
  phone: string
  website: string
  notes: string
  instagram_url: string
  linkedin_url: string
  drive_folder_id: string
}

const emptyForm: FormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  notes: '',
  instagram_url: '',
  linkedin_url: '',
  drive_folder_id: '',
}

// ─── Componente ─────────────────────────────────────────────────────────

export default function ClientsPage() {
  const supabase = createClient()
  const { can, loading: loadingPerms } = usePermissions()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [driveStatus, setDriveStatus] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    setLoading(true)

    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .order('name')

    if (!clientsData) { setLoading(false); return }

    // Contar proyectos por cliente
    const { data: projectCounts } = await supabase
      .from('projects')
      .select('client_id')
      .in('client_id', clientsData.map(c => c.id))

    const countMap: Record<string, number> = {}
    projectCounts?.forEach(p => {
      if (p.client_id) countMap[p.client_id] = (countMap[p.client_id] || 0) + 1
    })

    setClients(clientsData.map(c => ({ ...c, project_count: countMap[c.id] || 0 })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])
// Permisos — siempre después de todos los hooks
  if (loadingPerms) return null
  if (!can('proyectos')) return <AccessDenied />

  // ── Modal ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingClient(null)
    setForm(emptyForm)
    setDriveStatus(null)
    setShowModal(true)
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setForm({
      name:            client.name,
      company:         client.company || '',
      email:           client.email || '',
      phone:           client.phone || '',
      website:         client.website || '',
      notes:           client.notes || '',
      instagram_url:   client.instagram_url || '',
      linkedin_url:    client.linkedin_url || '',
      drive_folder_id: client.drive_folder_id || '',
    })
    setDriveStatus(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingClient(null)
    setForm(emptyForm)
    setDriveStatus(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setDriveStatus(null)

    const payload = {
      name:            form.name.trim(),
      company:         form.company.trim() || null,
      email:           form.email.trim() || null,
      phone:           form.phone.trim() || null,
      website:         form.website.trim() || null,
      notes:           form.notes.trim() || null,
      instagram_url:   form.instagram_url.trim() || null,
      linkedin_url:    form.linkedin_url.trim() || null,
      drive_folder_id: form.drive_folder_id.trim() || null,
    }

    if (editingClient) {
      // ── Editar ──
      await supabase.from('clients').update(payload).eq('id', editingClient.id)
      setSaving(false)
      closeModal()
      fetchClients()
    } else {
      // ── Crear ──
      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert(payload)
        .select('id, name')
        .single()

      if (insertError || !newClient) {
        console.error('Error creando cliente:', insertError)
        setSaving(false)
        return
      }

      // Crear estructura en Drive automáticamente
      setDriveStatus('Creando carpetas en Drive...')

      try {
        const driveRes = await fetch('/api/drive/setup-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: newClient.id,
            clientName: newClient.name,
          }),
        })

        const driveData = await driveRes.json()

        if (driveRes.ok && driveData.success) {
          setDriveStatus(driveData.warning ? '⚠️ ' + driveData.warning : '✅ Carpetas creadas en Drive')
        } else {
          setDriveStatus('⚠️ Cliente creado, pero hubo un error con Drive: ' + (driveData.error || 'Error desconocido'))
        }
      } catch {
        setDriveStatus('⚠️ Cliente creado, pero no se pudo conectar con Drive')
      }

      setSaving(false)
      fetchClients()

      // Cerrar modal después de un momento para que se vea el estado
      setTimeout(() => {
        closeModal()
      }, 2000)
    }
  }

  const handleDelete = async (client: Client) => {
    if (!confirm(`¿Eliminar a "${client.name}"? Esta acción no se puede deshacer.`)) return
    await supabase.from('clients').delete().eq('id', client.id)
    fetchClients()
  }

  // ── Filtrado ──────────────────────────────────────────────────────────

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">Clientes</h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {clients.length} clientes en total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm bg-white dark:bg-fp-card-dark">
              <Search size={14} className="text-gray-400 dark:text-fp-text-secondary" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew placeholder-gray-400 dark:placeholder-fp-text-tertiary w-44"
              />
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 transition-colors"
            >
              <Plus size={15} /> Nuevo cliente
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="p-8">
        {loading ? (
          <p className="text-center py-16 text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando clientes...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
            <Users size={40} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">
              {search ? 'Sin resultados' : 'No hay clientes todavía'}
            </h3>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mb-4">
              {search ? `No se encontró "${search}"` : 'Agregá tu primer cliente para empezar'}
            </p>
            {!search && (
              <button
                onClick={openCreate}
                className="px-4 py-2 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-sm font-semibold hover:bg-fp-punch-red/20"
              >
                <Plus size={14} className="inline mr-1" /> Crear cliente
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(client => {
              const isExpanded = expandedId === client.id
              const hasDrive = !!client.drive_folder_id
              return (
                <div
                  key={client.id}
                  className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden hover:border-fp-cerulean/30 transition-colors"
                >
                  {/* Fila principal */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fp-cerulean/20 to-fp-navy/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-fp-cerulean font-bold text-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">{client.name}</span>
                        {client.company && (
                          <span className="text-xs text-gray-400 dark:text-fp-text-tertiary flex items-center gap-1">
                            <Building2 size={11} /> {client.company}
                          </span>
                        )}
                        {hasDrive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 font-medium">
                            Drive ✓
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 dark:text-fp-text-tertiary flex-wrap">
                        {client.email && (
                          <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-fp-cerulean transition-colors">
                            <Mail size={11} /> {client.email}
                          </a>
                        )}
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={11} /> {client.phone}
                          </span>
                        )}
                        {client.project_count !== undefined && client.project_count > 0 && (
                          <span className="flex items-center gap-1 text-fp-cerulean">
                            <FolderOpen size={11} /> {client.project_count} proyecto{client.project_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Links rápidos */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {client.website && (
                        <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors" title="Sitio web">
                          <Globe size={14} />
                        </a>
                      )}
                      {client.instagram_url && (
                        <a href={client.instagram_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors" title="Instagram">
                          <Instagram size={14} />
                        </a>
                      )}
                      {client.linkedin_url && (
                        <a href={client.linkedin_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors" title="LinkedIn">
                          <Linkedin size={14} />
                        </a>
                      )}
                      {client.drive_folder_id && (
                        <a href={`https://drive.google.com/drive/folders/${client.drive_folder_id}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors" title="Carpeta Drive">
                          <ExternalLink size={14} />
                        </a>
                      )}

                      {/* Botón expandir */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : client.id)}
                        className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors ml-1"
                        title="Ver más"
                      >
                        <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Editar */}
                      <button
                        onClick={() => openEdit(client)}
                        className="px-3 py-1 rounded-lg text-xs text-gray-500 dark:text-fp-text-secondary border border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean hover:text-fp-cerulean transition-colors ml-1"
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-fp-border-dark px-5 py-4 bg-gray-50/50 dark:bg-fp-hover-dark/30">
                      <div className="grid grid-cols-2 gap-4">
                        {client.notes && (
                          <div className="col-span-2">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-fp-text-tertiary mb-1">
                              <StickyNote size={11} /> Notas
                            </div>
                            <p className="text-sm text-fp-navy dark:text-fp-honeydew leading-relaxed">{client.notes}</p>
                          </div>
                        )}
                        {client.drive_folder_id && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-fp-text-tertiary mb-1">
                              <FolderSync size={11} /> Carpeta Drive (Proyectos)
                            </div>
                            <a
                              href={`https://drive.google.com/drive/folders/${client.drive_folder_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-fp-cerulean hover:underline font-mono truncate block"
                            >
                              {client.drive_folder_id}
                            </a>
                          </div>
                        )}
                        {client.drive_fee_folder_id && (
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-fp-text-tertiary mb-1">
                              <FolderSync size={11} /> Carpeta Drive (Fee Mensual)
                            </div>
                            <a
                              href={`https://drive.google.com/drive/folders/${client.drive_fee_folder_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-fp-cerulean hover:underline font-mono truncate block"
                            >
                              {client.drive_fee_folder_id}
                            </a>
                          </div>
                        )}
                        <div className="col-span-2 flex justify-end">
                          <button
                            onClick={() => handleDelete(client)}
                            className="text-xs text-fp-punch-red hover:underline"
                          >
                            Eliminar cliente
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal crear / editar ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
              <h2 className="text-base font-semibold text-fp-navy dark:text-fp-honeydew">
                {editingClient ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-fp-punch-red">
                <X size={18} />
              </button>
            </div>

            {/* Campos */}
            <div className="px-6 py-5 space-y-4">

              {/* Nombre + Empresa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Juan García"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Empresa</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={e => setForm({ ...form, company: e.target.value })}
                    placeholder="Ej: Ames Motos"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
              </div>

              {/* Email + Teléfono */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="cliente@email.com"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+54 9 11..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Sitio web</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  placeholder="www.cliente.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                />
              </div>

              {/* Instagram + LinkedIn */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Instagram</label>
                  <input
                    type="text"
                    value={form.instagram_url}
                    onChange={e => setForm({ ...form, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">LinkedIn</label>
                  <input
                    type="text"
                    value={form.linkedin_url}
                    onChange={e => setForm({ ...form, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
              </div>

              {/* Drive folder ID — solo en edición */}
              {editingClient && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">
                    ID carpeta Drive <span className="text-fp-text-tertiary">(03_Proyectos_Específicos del cliente)</span>
                  </label>
                  <input
                    type="text"
                    value={form.drive_folder_id}
                    onChange={e => setForm({ ...form, drive_folder_id: e.target.value })}
                    placeholder="1qADx0hzJe2aVr5SV043G-5GAMT2w9T6r"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean font-mono"
                  />
                  <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-1">
                    Encontralo en Drive → URL de la carpeta → el ID es la parte después de /folders/
                  </p>
                </div>
              )}

              {/* Info de auto-creación en modo crear */}
              {!editingClient && (
                <div className="bg-fp-cerulean/5 border border-fp-cerulean/20 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-fp-cerulean font-medium">
                    <FolderSync size={13} />
                    Al crear el cliente, se genera automáticamente su carpeta en Drive con toda la estructura.
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Notas internas</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Contexto del cliente, preferencias, referencias..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean resize-none"
                />
              </div>

              {/* Estado de Drive */}
              {driveStatus && (
                <div className="bg-fp-navy/5 dark:bg-fp-navy/20 border border-fp-border-dark rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-xs text-fp-honeydew dark:text-fp-honeydew">
                    {saving && <Loader2 size={13} className="animate-spin text-fp-cerulean" />}
                    <span className="text-fp-navy dark:text-fp-honeydew">{driveStatus}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-fp-border-dark">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 dark:text-fp-text-secondary hover:bg-gray-100 dark:hover:bg-fp-hover-dark"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="px-5 py-2 rounded-lg bg-fp-cerulean text-white text-sm font-semibold hover:bg-fp-cerulean/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving
                  ? (editingClient ? 'Guardando...' : 'Creando...')
                  : editingClient ? 'Guardar cambios' : 'Crear cliente'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
