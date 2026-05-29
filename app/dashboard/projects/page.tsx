'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Plus, Search, FolderOpen, Calendar, Users, X, FolderSync,
  LayoutGrid, List, Pencil, TrendingUp, CheckCircle2, AlertCircle,
  Clock, ExternalLink, Github, Activity,
} from 'lucide-react'

const DRIVE_INTERNAL_FOLDER_ID = '1h6CMaem7H6SyfksqM-r9ebYqqCEoCX-y'
const DRIVE_PROYECTOS_TEMPLATE_ID = '1qADx0hzJe2aVr5SV043G-5GAMT2w9T6r'

type Project = {
  id: string; name: string; description: string | null; status: string
  budget: number | null; currency: string; start_date: string | null
  due_date: string | null; drive_folder_url: string | null
  drive_folder_id: string | null; github_repo_url: string | null
  created_at: string; client_id: string | null; members: string[] | null
  clients?: { id: string; name: string } | null
  tasks?: { id: string; status: string }[]
}
type Client = { id: string; name: string; company: string | null; drive_folder_id: string | null }
type Profile = { id: string; full_name: string | null; avatar_url: string | null; email: string }
type ProjectUpdate = {
  id: string; project_id: string; user_id: string | null; type: string
  description: string; created_at: string
  projects?: { name: string } | null
  profiles?: { full_name: string | null } | null
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Borrador',   bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10', text: 'text-gray-500 dark:text-fp-text-tertiary' },
  active:    { label: 'Activo',     bg: 'bg-fp-cerulean/10',                        text: 'text-fp-cerulean' },
  paused:    { label: 'Pausado',    bg: 'bg-amber-500/10',                           text: 'text-amber-500' },
  completed: { label: 'Completado', bg: 'bg-fp-frosted/10',                          text: 'text-fp-frosted' },
  archived:  { label: 'Archivado',  bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10',  text: 'text-gray-400 dark:text-fp-text-tertiary' },
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function AvatarGroup({ members, profiles }: { members: string[]; profiles: Profile[] }) {
  const visible = members.slice(0, 4)
  const rest = members.length - 4
  return (
    <div className="flex -space-x-1.5">
      {visible.map(id => {
        const p = profiles.find(pr => pr.id === id)
        return (
          <div key={id} title={p?.full_name || p?.email || id}
            className="w-6 h-6 rounded-full bg-gradient-to-br from-fp-cerulean to-fp-navy flex items-center justify-center text-white text-[9px] font-bold border-2 border-white dark:border-fp-card-dark flex-shrink-0">
            {getInitials(p?.full_name || p?.email)}
          </div>
        )
      })}
      {rest > 0 && (
        <div className="w-6 h-6 rounded-full bg-fp-text-tertiary/20 flex items-center justify-center text-[9px] font-bold border-2 border-white dark:border-fp-card-dark flex-shrink-0 text-fp-text-tertiary">
          +{rest}
        </div>
      )}
    </div>
  )
}

const emptyForm = { name: '', description: '', client_id: '', status: 'active', budget: '', currency: 'USD', start_date: '', due_date: '', github_repo_url: '' }
const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
const labelClass = "text-xs text-gray-500 dark:text-fp-text-secondary block mb-1"

// ─── ProjectModal FUERA del componente principal ───────────────────────────
// (CRÍTICO: si está adentro, React destruye y recrea el modal con cada tecla
//  haciendo que el input pierda el foco después de cada letra)
function ProjectModal({
  f, setF, title, onSave, onCancel, drStatus, clients, saving,
}: {
  f: typeof emptyForm
  setF: (v: typeof emptyForm) => void
  title: string
  onSave: () => void
  onCancel: () => void
  drStatus?: string
  clients: Client[]
  saving: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
          <h2 className="text-base font-semibold text-fp-navy dark:text-fp-honeydew">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-fp-punch-red"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div><label className={labelClass}>Nombre *</label><input type="text" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ej: eCommerce Naturae" className={inputClass} /></div>
          <div><label className={labelClass}>Descripción</label><textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} rows={2} className={inputClass + ' resize-none'} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Cliente</label>
              <select value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })} className={inputClass}>
                <option value="">Proyecto interno</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>Estado</label>
              <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} className={inputClass}>
                <option value="draft">Borrador</option><option value="active">Activo</option>
                <option value="paused">Pausado</option><option value="completed">Completado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className={labelClass}>Presupuesto</label><input type="number" value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} placeholder="0.00" className={inputClass} /></div>
            <div><label className={labelClass}>Moneda</label>
              <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} className={inputClass}>
                <option value="USD">USD</option><option value="ARS">ARS</option><option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Inicio</label><input type="date" value={f.start_date} onChange={e => setF({ ...f, start_date: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>Entrega</label><input type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>Link repo GitHub</label><input type="url" value={f.github_repo_url} onChange={e => setF({ ...f, github_repo_url: e.target.value })} placeholder="https://github.com/..." className={inputClass} /></div>
          {title === 'Nuevo proyecto' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fp-cerulean/5 border border-fp-cerulean/15 text-xs text-fp-cerulean">
              <FolderSync size={13} className="flex-shrink-0" />
              <span>{f.client_id ? 'Se creará una carpeta automáticamente en Drive dentro de ese cliente.' : 'Proyecto interno: se creará la carpeta en 04_AGENCIA_INTERNA → 04_Proyectos.'}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 dark:border-fp-border-dark">
          <div className="text-xs min-h-[16px]">
            {drStatus === 'creating' && <span className="text-fp-cerulean animate-pulse">Creando carpeta en Drive...</span>}
            {drStatus === 'done' && <span className="text-green-500">✓ Carpeta creada en Drive</span>}
            {drStatus === 'error' && <span className="text-amber-500">⚠ No se pudo crear en Drive (el proyecto se guardó igual)</span>}
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-fp-hover-dark">Cancelar</button>
            <button onClick={onSave} disabled={!f.name.trim() || saving} className="px-5 py-2 rounded-lg bg-fp-cerulean text-white text-sm font-semibold hover:bg-fp-cerulean/90 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)
  const [driveStatus, setDriveStatus] = useState<'idle' | 'creating' | 'done' | 'error'>('idle')
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)

  const fetchAll = async () => {
    setLoading(true)
    const [projRes, cliRes, profRes, updRes] = await Promise.all([
      supabase.from('projects').select('*, clients(id, name), tasks(id, status)').order('updated_at', { ascending: false }),
      supabase.from('clients').select('id, name, company, drive_folder_id').order('name'),
      supabase.from('profiles').select('id, full_name, avatar_url, email'),
      supabase.from('project_updates').select('*, projects(name), profiles(full_name)').order('created_at', { ascending: false }).limit(12),
    ])
    setProjects(projRes.data || [])
    setClients(cliRes.data || [])
    setProfiles(profRes.data || [])
    setUpdates(updRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const getProgress = (p: Project) => {
    const total = p.tasks?.length || 0
    const done = p.tasks?.filter(t => t.status === 'done').length || 0
    return total > 0 ? Math.round((done / total) * 100) : 0
  }

  const activeCount = projects.filter(p => p.status === 'active').length
  const completedCount = projects.filter(p => p.status === 'completed').length
  const pendingTasksCount = projects.reduce((acc, p) => acc + (p.tasks?.filter(t => t.status !== 'done').length || 0), 0)
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + getProgress(p), 0) / projects.length) : 0

  let filtered = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.clients?.name?.toLowerCase().includes(search.toLowerCase()))
  if (filterStatus !== 'all') filtered = filtered.filter(p => p.status === filterStatus)
  if (filterClient !== 'all') filtered = filtered.filter(p => p.client_id === filterClient)

  const counts: Record<string, number> = {
    all: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    paused: projects.filter(p => p.status === 'paused').length,
    completed: projects.filter(p => p.status === 'completed').length,
    draft: projects.filter(p => p.status === 'draft').length,
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true); setDriveStatus('idle')
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setSaving(false); return }
    const { data: newProject, error } = await supabase.from('projects').insert({
      name: form.name.trim(), description: form.description.trim() || null,
      client_id: form.client_id || null, status: form.status,
      budget: form.budget ? parseFloat(form.budget) : null, currency: form.currency,
      start_date: form.start_date || null, due_date: form.due_date || null,
      github_repo_url: form.github_repo_url.trim() || null, created_by: userData.user.id,
    }).select().single()
    if (error || !newProject) { setSaving(false); return }
    setDriveStatus('creating')
    let parentFolderId = DRIVE_INTERNAL_FOLDER_ID
    if (form.client_id) {
      const sel = clients.find(c => c.id === form.client_id)
      parentFolderId = sel?.drive_folder_id || DRIVE_PROYECTOS_TEMPLATE_ID
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const driveRes = await fetch('/api/drive/create-folder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName: form.name.trim(), parentId: parentFolderId, providerToken: session?.provider_token }),
      })
      const driveData = await driveRes.json()
      if (driveRes.ok) {
        await supabase.from('projects').update({ drive_folder_url: driveData.folderUrl, drive_folder_id: driveData.folderId }).eq('id', newProject.id)
        setDriveStatus('done')
      } else { setDriveStatus('error') }
    } catch { setDriveStatus('error') }
    setShowCreate(false); setForm(emptyForm); setDriveStatus('idle'); await fetchAll(); setSaving(false)
  }

  const openEdit = (p: Project) => {
    setEditingProject(p)
    setEditForm({ name: p.name, description: p.description || '', client_id: p.client_id || '', status: p.status, budget: p.budget?.toString() || '', currency: p.currency || 'USD', start_date: p.start_date || '', due_date: p.due_date || '', github_repo_url: p.github_repo_url || '' })
    setShowEdit(true)
  }
  const handleSaveEdit = async () => {
    if (!editingProject || !editForm.name.trim()) return
    setSaving(true)
    await supabase.from('projects').update({
      name: editForm.name.trim(), description: editForm.description.trim() || null,
      client_id: editForm.client_id || null, status: editForm.status,
      budget: editForm.budget ? parseFloat(editForm.budget) : null, currency: editForm.currency,
      start_date: editForm.start_date || null, due_date: editForm.due_date || null,
      github_repo_url: editForm.github_repo_url.trim() || null,
    }).eq('id', editingProject.id)
    setShowEdit(false); setEditingProject(null); await fetchAll(); setSaving(false)
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark text-sm">
              <Search size={14} className="text-gray-400 dark:text-fp-text-tertiary" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew placeholder:text-gray-400 w-32" />
            </div>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none">
              <option value="all">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex items-center border border-gray-200 dark:border-fp-border-dark rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('cards')} className={`p-1.5 transition-colors ${viewMode === 'cards' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark'}`}><LayoutGrid size={15} /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark'}`}><List size={15} /></button>
            </div>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 transition-colors">
              <Plus size={15} /> Nuevo proyecto
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {[{ key: 'all', label: 'Todos' }, { key: 'active', label: 'Activos' }, { key: 'paused', label: 'Pausados' }, { key: 'completed', label: 'Completados' }, { key: 'draft', label: 'Borradores' }].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filterStatus === f.key ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 dark:text-fp-text-tertiary hover:bg-gray-100 dark:hover:bg-fp-hover-dark'}`}>
              {f.label} <span className="ml-1 opacity-60">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Proyectos activos', value: activeCount, icon: <TrendingUp size={16} />, color: 'text-fp-cerulean', bg: 'bg-fp-cerulean/10' },
            { label: 'Completados', value: completedCount, icon: <CheckCircle2 size={16} />, color: 'text-fp-frosted', bg: 'bg-fp-frosted/10' },
            { label: 'Tareas pendientes', value: pendingTasksCount, icon: <AlertCircle size={16} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Progreso promedio', value: `${avgProgress}%`, icon: <Activity size={16} />, color: 'text-fp-punch-red', bg: 'bg-fp-punch-red/10' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 dark:text-fp-text-tertiary">{stat.label}</span>
                <span className={`p-1.5 rounded-lg ${stat.bg} ${stat.color}`}>{stat.icon}</span>
              </div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Projects main area */}
          <div className="col-span-2">
            {loading ? (
              <p className="text-center py-16 text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando...</p>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
                <FolderOpen size={40} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">{search ? 'Sin resultados' : 'No hay proyectos todavía'}</h3>
                <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mb-4">{search ? `No se encontraron proyectos para "${search}"` : 'Creá tu primer proyecto para empezar'}</p>
                {!search && <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-sm font-semibold hover:bg-fp-punch-red/20"><Plus size={14} className="inline mr-1" />Crear proyecto</button>}
              </div>
            ) : viewMode === 'cards' ? (
              <div className="grid grid-cols-2 gap-4">
                {filtered.map(project => {
                  const progress = getProgress(project)
                  const status = statusConfig[project.status] || statusConfig.draft
                  const total = project.tasks?.length || 0
                  const done = project.tasks?.filter(t => t.status === 'done').length || 0
                  return (
                    <div key={project.id} className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4 hover:border-fp-cerulean/30 transition-colors group relative">
                      <button
                        onClick={e => { e.preventDefault(); openEdit(project) }}
                        className="absolute top-3 right-3 p-1 rounded-md text-gray-300 hover:text-fp-cerulean opacity-0 group-hover:opacity-100 transition-all"
                      ><Pencil size={13} /></button>
                      <Link href={`/dashboard/projects/${project.id}`} className="block">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fp-cerulean/20 to-fp-navy/20 flex items-center justify-center flex-shrink-0">
                            <FolderOpen size={14} className="text-fp-cerulean" />
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.text}`}>{status.label}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-0.5 truncate pr-5">{project.name}</h3>
                        {project.clients
                          ? <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mb-3 truncate">{project.clients.name}</p>
                          : <p className="text-xs text-fp-cerulean italic mb-3">Proyecto interno</p>
                        }
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">{done}/{total} tareas</span>
                            <span className="text-[10px] font-semibold text-fp-cerulean">{progress}%</span>
                          </div>
                          <div className="w-full h-1 bg-gray-100 dark:bg-fp-hover-dark rounded-full overflow-hidden">
                            <div className="h-full bg-fp-cerulean rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          {project.due_date
                            ? <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-fp-text-tertiary"><Calendar size={10} />{new Date(project.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                            : <span />
                          }
                          {project.members && project.members.length > 0 && <AvatarGroup members={project.members} profiles={profiles} />}
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_130px_90px_110px_90px_32px] gap-3 px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark text-xs text-gray-400 dark:text-fp-text-tertiary uppercase tracking-wider font-medium">
                  <span>Proyecto</span><span>Cliente</span><span>Estado</span><span>Progreso</span><span>Entrega</span><span />
                </div>
                {filtered.map(project => {
                  const progress = getProgress(project)
                  const status = statusConfig[project.status] || statusConfig.draft
                  return (
                    <div key={project.id} className="grid grid-cols-[1fr_130px_90px_110px_90px_32px] gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-fp-border-dark last:border-0 items-center hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors group">
                      <Link href={`/dashboard/projects/${project.id}`} className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fp-cerulean/20 to-fp-navy/20 flex items-center justify-center flex-shrink-0">
                          <FolderOpen size={12} className="text-fp-cerulean" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{project.name}</div>
                          {project.members && project.members.length > 0 && <div className="mt-0.5"><AvatarGroup members={project.members} profiles={profiles} /></div>}
                        </div>
                      </Link>
                      <span className="text-xs text-gray-400 dark:text-fp-text-tertiary truncate">{project.clients?.name || <span className="italic text-fp-cerulean text-[10px]">Interno</span>}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${status.bg} ${status.text}`}>{status.label}</span>
                      <div>
                        <div className="flex justify-between mb-1"><span className="text-[10px] text-fp-cerulean font-semibold">{progress}%</span></div>
                        <div className="w-full h-1 bg-gray-100 dark:bg-fp-hover-dark rounded-full overflow-hidden">
                          <div className="h-full bg-fp-cerulean rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-fp-text-tertiary">{project.due_date ? new Date(project.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—'}</span>
                      <button onClick={() => openEdit(project)} className="p-1 rounded-md text-gray-300 hover:text-fp-cerulean opacity-0 group-hover:opacity-100 transition-all"><Pencil size={13} /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Updates */}
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden h-fit">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex items-center gap-2">
              <Activity size={14} className="text-fp-cerulean" />
              <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Recent Updates</h3>
            </div>
            {updates.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Clock size={28} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-2" />
                <p className="text-xs text-gray-400 dark:text-fp-text-tertiary">Sin actividad reciente</p>
              </div>
            ) : (
              <div>
                {updates.map(u => (
                  <div key={u.id} className="px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark last:border-0">
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-fp-cerulean/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[8px] font-bold text-fp-cerulean">{getInitials(u.profiles?.full_name)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-fp-navy dark:text-fp-honeydew leading-relaxed">{u.description}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {u.projects?.name && <span className="text-[10px] text-fp-cerulean font-medium truncate">{u.projects.name}</span>}
                          <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">
                            {new Date(u.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <ProjectModal
          f={form} setF={setForm}
          title="Nuevo proyecto"
          onSave={handleCreate}
          onCancel={() => { setShowCreate(false); setForm(emptyForm) }}
          drStatus={driveStatus}
          clients={clients}
          saving={saving}
        />
      )}
      {showEdit && editingProject && (
        <ProjectModal
          f={editForm} setF={setEditForm}
          title={`Editar: ${editingProject.name}`}
          onSave={handleSaveEdit}
          onCancel={() => { setShowEdit(false); setEditingProject(null) }}
          clients={clients}
          saving={saving}
        />
      )}
    </div>
  )
}
