'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Search, FolderOpen, ExternalLink, Calendar, DollarSign, Users, X, FolderSync } from 'lucide-react'

// IDs de carpetas raíz en Google Drive
const DRIVE_INTERNAL_FOLDER_ID = '1I4pQsedeCqQnM21Krtgh4WIlwTv36rGM'     // 04_AGENCIA_INTERNA > 04_Proyectos
const DRIVE_PROYECTOS_TEMPLATE_ID = '1qADx0hzJe2aVr5SV043G-5GAMT2w9T6r'  // 03_Proyectos_Específicos (plantilla)

type Project = {
  id: string
  name: string
  description: string | null
  status: string
  budget: number | null
  currency: string
  start_date: string | null
  due_date: string | null
  drive_folder_url: string | null
  github_repo_url: string | null
  created_at: string
  client_id: string | null
  clients?: { id: string; name: string } | null
}

type Client = {
  id: string
  name: string
  company: string | null
  drive_folder_id: string | null
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Borrador',   bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10', text: 'text-gray-500 dark:text-fp-text-tertiary' },
  active:    { label: 'Activo',     bg: 'bg-fp-cerulean/10',                        text: 'text-fp-cerulean' },
  paused:    { label: 'Pausado',    bg: 'bg-amber-500/10',                           text: 'text-amber-500' },
  completed: { label: 'Completado', bg: 'bg-fp-frosted/10',                          text: 'text-fp-frosted' },
  archived:  { label: 'Archivado', bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10',   text: 'text-gray-400 dark:text-fp-text-tertiary' },
}

export default function ProjectsPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [driveStatus, setDriveStatus] = useState<'idle' | 'creating' | 'done' | 'error'>('idle')

  const [form, setForm] = useState({
    name: '',
    description: '',
    client_id: '',
    status: 'active',
    budget: '',
    currency: 'USD',
    start_date: '',
    due_date: '',
    github_repo_url: '',
  })

  const fetchProjects = async () => {
    setLoading(true)
    let query = supabase.from('projects').select('*, clients(id, name)').order('updated_at', { ascending: false })
    if (filterStatus !== 'all') query = query.eq('status', filterStatus)
    const { data } = await query
    setProjects(data || [])
    setLoading(false)
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name, company, drive_folder_id').order('name')
    setClients(data || [])
  }

  useEffect(() => { fetchProjects(); fetchClients() }, [filterStatus])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setDriveStatus('idle')

    // 1 — Verificar auth
    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData.user) {
      alert('Error de autenticación')
      setSaving(false)
      return
    }

    // 2 — Guardar proyecto en Supabase (sin drive_folder_url todavía)
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        client_id: form.client_id || null,
        status: form.status,
        budget: form.budget ? parseFloat(form.budget) : null,
        currency: form.currency,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        github_repo_url: form.github_repo_url.trim() || null,
        created_by: userData.user.id,
      })
      .select()
      .single()

    if (error || !newProject) {
      alert(`Error al guardar: ${error?.message}`)
      setSaving(false)
      return
    }

    // 3 — Crear carpeta en Drive
    setDriveStatus('creating')

    // Determinar carpeta padre:
    // - Proyecto con cliente que tiene drive_folder_id → usar ese ID
    // - Proyecto con cliente sin drive_folder_id → usar plantilla (03_Proyectos_Específicos)
    // - Proyecto interno → 02_LAB_AUTOMATIZACIONES
    let parentFolderId = DRIVE_INTERNAL_FOLDER_ID

    if (form.client_id) {
      const selectedClient = clients.find(c => c.id === form.client_id)
      parentFolderId = selectedClient?.drive_folder_id || DRIVE_PROYECTOS_TEMPLATE_ID
    }

    try {
      // Obtener provider_token del lado del cliente (no disponible server-side en Supabase)
      const { data: { session } } = await supabase.auth.getSession()
      const providerToken = session?.provider_token

      const driveRes = await fetch('/api/drive/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderName: form.name.trim(),
          parentId: parentFolderId,
          providerToken,
        }),
      })

      const driveData = await driveRes.json()

      if (!driveRes.ok) {
        // Drive falló, pero el proyecto ya está guardado — no bloqueamos
        console.warn('Drive error:', driveData.error)
        setDriveStatus('error')
      } else {
        // 4 — Actualizar proyecto con la URL de Drive generada
        await supabase
          .from('projects')
          .update({ drive_folder_url: driveData.folderUrl })
          .eq('id', newProject.id)

        setDriveStatus('done')
      }
    } catch (e) {
      console.warn('Drive fetch error:', e)
      setDriveStatus('error')
    }

    // 5 — Cerrar modal y refrescar lista
    setShowCreate(false)
    setForm({
      name: '', description: '', client_id: '', status: 'active',
      budget: '', currency: 'USD', start_date: '', due_date: '', github_repo_url: '',
    })
    setDriveStatus('idle')
    await fetchProjects()
    setSaving(false)
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.clients?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const counts: Record<string, number> = {
    all: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    paused: projects.filter(p => p.status === 'paused').length,
    completed: projects.filter(p => p.status === 'completed').length,
    draft: projects.filter(p => p.status === 'draft').length,
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">Proyectos</h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">{projects.length} proyectos en total</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm bg-white dark:bg-fp-card-dark">
              <Search size={14} className="text-gray-400 dark:text-fp-text-tertiary" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar proyecto..."
                className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew placeholder:text-gray-400 dark:placeholder:text-fp-text-tertiary w-44"
              />
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 transition-colors"
            >
              <Plus size={15} /> Nuevo proyecto
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mt-3">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'active', label: 'Activos' },
            { key: 'paused', label: 'Pausados' },
            { key: 'completed', label: 'Completados' },
            { key: 'draft', label: 'Borradores' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === f.key
                  ? 'bg-fp-cerulean/10 text-fp-cerulean'
                  : 'text-gray-400 dark:text-fp-text-tertiary hover:bg-gray-100 dark:hover:bg-fp-hover-dark'
              }`}
            >
              {f.label} <span className="ml-1 opacity-60">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="p-8">
        {loading ? (
          <p className="text-center py-16 text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
            <FolderOpen size={40} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">
              {search ? 'Sin resultados' : 'No hay proyectos todavía'}
            </h3>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mb-4">
              {search ? `No se encontraron proyectos para "${search}"` : 'Creá tu primer proyecto para empezar'}
            </p>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-sm font-semibold hover:bg-fp-punch-red/20"
              >
                <Plus size={14} className="inline mr-1" /> Crear proyecto
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(project => {
              const status = statusConfig[project.status] || statusConfig.draft
              return (
                <Link
                  key={project.id}
                  href={`/dashboard/projects/${project.id}`}
                  className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5 hover:border-fp-cerulean/30 transition-colors flex items-center gap-5"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fp-cerulean/20 to-fp-navy/20 flex items-center justify-center flex-shrink-0">
                    <FolderOpen size={18} className="text-fp-cerulean" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">{project.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-fp-text-tertiary">
                      {project.clients
                        ? <span className="flex items-center gap-1"><Users size={11} /> {project.clients.name}</span>
                        : <span className="italic text-fp-cerulean">Proyecto interno</span>
                      }
                      {project.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {new Date(project.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          {project.due_date && ` — ${new Date(project.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
                        </span>
                      )}
                      {project.budget && (
                        <span className="flex items-center gap-1">
                          <DollarSign size={11} /> {project.currency} {project.budget.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-1.5 truncate">{project.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {project.drive_folder_url && (
                      <a
                        href={project.drive_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="p-2 rounded-lg text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10"
                        title="Abrir en Drive"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal crear proyecto */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
              <h2 className="text-base font-semibold text-fp-navy dark:text-fp-honeydew">Nuevo proyecto</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-fp-punch-red">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: eCommerce Naturae"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción breve..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean resize-none"
                />
              </div>

              {/* Cliente + Estado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Cliente</label>
                  <select
                    value={form.client_id}
                    onChange={e => setForm({ ...form, client_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
                  >
                    <option value="">Proyecto interno</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
                  >
                    <option value="draft">Borrador</option>
                    <option value="active">Activo</option>
                    <option value="paused">Pausado</option>
                    <option value="completed">Completado</option>
                  </select>
                </div>
              </div>

              {/* Presupuesto + Moneda */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Presupuesto</label>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={e => setForm({ ...form, budget: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Moneda</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Inicio</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Entrega</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
              </div>

              {/* GitHub */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary block mb-1">Link repo GitHub</label>
                <input
                  type="url"
                  value={form.github_repo_url}
                  onChange={e => setForm({ ...form, github_repo_url: e.target.value })}
                  placeholder="https://github.com/..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                />
              </div>

              {/* Aviso Drive automático */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fp-cerulean/5 border border-fp-cerulean/15 text-xs text-fp-cerulean">
                <FolderSync size={13} className="flex-shrink-0" />
                <span>
                  {form.client_id
                    ? 'Se creará una carpeta automáticamente en Drive dentro de ese cliente.'
                    : 'Proyecto interno: se creará la carpeta en 04_AGENCIA_INTERNA → 04_Proyectos.'
                  }
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-gray-100 dark:border-fp-border-dark">
              <div className="text-xs text-gray-400 dark:text-fp-text-tertiary min-h-[16px]">
                {driveStatus === 'creating' && <span className="text-fp-cerulean animate-pulse">Creando carpeta en Drive...</span>}
                {driveStatus === 'done'     && <span className="text-green-500">✓ Carpeta creada en Drive</span>}
                {driveStatus === 'error'    && <span className="text-amber-500">⚠ No se pudo crear en Drive (el proyecto se guardó igual)</span>}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-500 dark:text-fp-text-secondary hover:bg-gray-100 dark:hover:bg-fp-hover-dark"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name.trim() || saving}
                  className="px-5 py-2 rounded-lg bg-fp-cerulean text-white text-sm font-semibold hover:bg-fp-cerulean/90 disabled:opacity-50"
                >
                  {saving ? 'Creando...' : 'Crear proyecto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}