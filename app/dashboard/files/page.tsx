'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload, FolderOpen, File, Image, Film, FileText, Trash2,
  ExternalLink, Eye, EyeOff, Search, Filter, Grid, List, X,
  ChevronDown, FolderSync, Loader2, CalendarDays, Briefcase,
  Tag, CheckSquare, Square,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────

type FileRecord = {
  id: string; name: string; file_type: string; storage_path: string | null
  drive_file_id: string | null; url: string | null; size_bytes: number | null
  mime_type: string | null; visible_to_client: boolean; category: string | null
  version: number; created_at: string; project_id: string
  projects?: { name: string; clients?: { name: string } | null } | null
}

type Project = {
  id: string; name: string; drive_folder_id: string | null
  client_id: string | null; clients: { name: string } | null
}

type ClientRecord = {
  id: string; name: string; drive_folder_id: string | null
  drive_fee_folder_id: string | null
}

// ─── Constantes ───────────────────────────────────────────────────────

const MONTHS = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const STATUS_OPTIONS = [
  { value: '_WIP', label: 'WIP', desc: 'Work In Progress — Borrador, no listo' },
  { value: '_REV', label: 'REV', desc: 'Revisión — Para que lo vea el PM o Socio' },
  { value: '_FIN', label: 'FIN', desc: 'Final — Aprobado internamente' },
  { value: '_OK', label: 'OK', desc: 'Aprobado Cliente — Versión definitiva' },
]

const fileTypeIcons: Record<string, typeof File> = {
  image: Image, video: Film, document: FileText, image_360: Image, other: File,
}
const fileTypeColors: Record<string, string> = {
  image: 'text-emerald-400 bg-emerald-400/10', video: 'text-purple-400 bg-purple-400/10',
  document: 'text-fp-cerulean bg-fp-cerulean/10', image_360: 'text-amber-400 bg-amber-400/10',
  other: 'text-fp-text-secondary bg-fp-text-secondary/10',
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function detectFileType(mime: string): string {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || mime.includes('sheet') || mime.includes('presentation')) return 'document'
  return 'other'
}

function getFileExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? '.' + parts.pop() : ''
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getDayName(year: number, month: number, day: number): string {
  return DAY_NAMES[new Date(year, month - 1, day).getDay()]
}

// ─── Componente ───────────────────────────────────────────────────────

export default function FilesPage() {
  const supabase = createClient()

  const [files, setFiles] = useState<FileRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [showClientFilterDropdown, setShowClientFilterDropdown] = useState(false)

  // Upload
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Upload destino
  const [uploadType, setUploadType] = useState<'fee' | 'project'>('project')
  const [uploadClientId, setUploadClientId] = useState('')
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear().toString())
  const [uploadMonth, setUploadMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'))
  const [uploadDay, setUploadDay] = useState(new Date().getDate().toString())

  // Nomenclatura
  const [forceNaming, setForceNaming] = useState(false)
  const [namingDesc, setNamingDesc] = useState('')
  const [namingStatus, setNamingStatus] = useState('_WIP')
  const [namingVersion, setNamingVersion] = useState(1)

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Dropdowns
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('files').select('*, projects(name, clients(name))').order('created_at', { ascending: false })
    if (filterProject !== 'all') query = query.eq('project_id', filterProject)
    if (filterType !== 'all') query = query.eq('file_type', filterType)
    const { data } = await query
    setFiles(data || [])
    setLoading(false)
  }, [filterProject, filterType])

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name, drive_folder_id, client_id, clients(name)').order('name')
    setProjects((data as unknown as Project[]) || [])
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name, drive_folder_id, drive_fee_folder_id').order('name')
    setClients((data as unknown as ClientRecord[]) || [])
  }

  useEffect(() => { fetchFiles(); fetchProjects(); fetchClients() }, [fetchFiles])

  // ── Helpers ────────────────────────────────────────────────────────

  const selectedClient = clients.find(c => c.id === uploadClientId)
  const clientProjects = projects.filter(p => p.client_id === uploadClientId && p.drive_folder_id)
  const dayNum = parseInt(uploadDay)
  const monthNum = parseInt(uploadMonth)
  const yearNum = parseInt(uploadYear)
  const maxDays = getDaysInMonth(yearNum, monthNum)
  const dayName = dayNum > 0 && dayNum <= maxDays ? getDayName(yearNum, monthNum, dayNum) : ''

  function buildFileName(originalName: string): string {
    if (!forceNaming || !namingDesc.trim()) return originalName
    const ext = getFileExtension(originalName)
    const dateStr = `${uploadYear}-${uploadMonth}-${uploadDay.padStart(2, '0')}`
    const clientName = selectedClient?.name.replace(/\s+/g, '') || 'Cliente'
    return `${dateStr}_${clientName}_${namingDesc.trim().replace(/\s+/g, '')}${namingStatus}_v${namingVersion}${ext}`
  }

  async function resolveTargetFolderId(): Promise<string | null> {
    if (uploadType === 'project') {
      const proj = projects.find(p => p.id === uploadProjectId)
      return proj?.drive_folder_id || null
    }
    if (!selectedClient?.drive_fee_folder_id) return null
    const monthLabel = MONTHS.find(m => m.value === uploadMonth)?.label || 'Mes'
    const dayPadded = uploadDay.padStart(2, '0')
    const pathSegments = [uploadYear, `${uploadYear}-${uploadMonth}_${monthLabel}`, `${dayPadded}_${dayName}`]
    try {
      const res = await fetch('/api/drive/ensure-path', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentFolderId: selectedClient.drive_fee_folder_id, pathSegments }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.folderId
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error creando ruta')
      return null
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────

  const handleUpload = async (fileList: FileList) => {
    setUploadError(null)
    if (uploadType === 'project' && !uploadProjectId) { setUploadError('Seleccioná un proyecto primero'); return }
    if (uploadType === 'fee' && !uploadClientId) { setUploadError('Seleccioná un cliente primero'); return }
    if (uploadType === 'fee' && !selectedClient?.drive_fee_folder_id) { setUploadError('Este cliente no tiene carpeta Fee Mensual en Drive.'); return }
    if (forceNaming && !namingDesc.trim()) { setUploadError('Ingresá un nombre descriptivo para el archivo'); return }

    setUploading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token
    if (!providerToken) { setUploadError('No hay token de Google. Cerrá sesión y volvé a entrar.'); setUploading(false); return }

    const targetFolderId = await resolveTargetFolderId()
    if (!targetFolderId) { if (!uploadError) setUploadError('No se pudo determinar la carpeta destino'); setUploading(false); return }

    let projectIdForDb = uploadType === 'project' ? uploadProjectId : null
    if (uploadType === 'fee' && !projectIdForDb) {
      const clientProj = projects.find(p => p.client_id === uploadClientId)
      projectIdForDb = clientProj?.id || null
    }

    let currentVersion = namingVersion
    for (const file of Array.from(fileList)) {
      const finalName = forceNaming ? buildFileName(file.name) : file.name
      const uploadFile = forceNaming ? new window.File([file], finalName, { type: file.type }) : file
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('parentFolderId', targetFolderId)
      formData.append('providerToken', providerToken)

      const res = await fetch('/api/drive/upload-file', { method: 'POST', body: formData })
      const driveData = await res.json()
      if (!res.ok) { setUploadError(`Error al subir "${file.name}": ${driveData.error}`); continue }

      if (projectIdForDb) {
        await supabase.from('files').insert({
          project_id: projectIdForDb, name: finalName, file_type: detectFileType(file.type),
          drive_file_id: driveData.fileId, url: driveData.webViewLink,
          size_bytes: driveData.size || file.size, mime_type: file.type,
          visible_to_client: false, version: forceNaming ? currentVersion : 1, storage_path: null,
        })
      }
      if (forceNaming) currentVersion++
    }
    setUploading(false); setShowUpload(false); setForceNaming(false); setNamingDesc(''); setNamingVersion(1); fetchFiles()
  }

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files.length > 0) { if (!showUpload) setShowUpload(true); handleUpload(e.dataTransfer.files) } }

  const toggleVisibility = async (file: FileRecord) => { await supabase.from('files').update({ visible_to_client: !file.visible_to_client }).eq('id', file.id); fetchFiles() }

  const deleteFile = async (file: FileRecord) => {
    if (!confirm(`¿Eliminar "${file.name}"?`)) return
    if (file.drive_file_id) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) {
        await fetch('/api/drive/delete-file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: file.drive_file_id, providerToken: session.provider_token }) })
      }
    }
    if (file.storage_path) await supabase.storage.from('project-files').remove([file.storage_path])
    await supabase.from('files').delete().eq('id', file.id); fetchFiles()
  }

  // ── Multi-select ───────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredFiles.map(f => f.id)))
  }

  const bulkToggleVisibility = async (visible: boolean) => {
    for (const id of Array.from(selectedIds)) {
      await supabase.from('files').update({ visible_to_client: visible }).eq('id', id)
    }
    setSelectedIds(new Set()); fetchFiles()
  }

  const bulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedIds.size} archivos seleccionados?`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token
    for (const id of Array.from(selectedIds)) {
      const file = files.find(f => f.id === id)
      if (!file) continue
      if (file.drive_file_id && providerToken) {
        await fetch('/api/drive/delete-file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: file.drive_file_id, providerToken }) })
      }
      if (file.storage_path) await supabase.storage.from('project-files').remove([file.storage_path])
      await supabase.from('files').delete().eq('id', id)
    }
    setSelectedIds(new Set()); fetchFiles()
  }

  // ── Filtrado ───────────────────────────────────────────────────────

  let filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  if (filterClient !== 'all') {
    filteredFiles = filteredFiles.filter(f => {
      const proj = projects.find(p => p.id === f.project_id)
      return proj?.client_id === filterClient
    })
  }

  const totalSize = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0)

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" onDragOver={(e) => { e.preventDefault(); setDragActive(true) }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}>
      {dragActive && (
        <div className="fixed inset-0 z-50 bg-fp-bg-dark/80 flex items-center justify-center">
          <div className="border-2 border-dashed border-fp-cerulean rounded-2xl p-16 text-center">
            <Upload size={48} className="text-fp-cerulean mx-auto mb-4" />
            <p className="text-fp-honeydew text-lg font-semibold">Soltá los archivos acá</p>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">Archivos</h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">{files.length} archivos · {formatSize(totalSize)} total</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm bg-white dark:bg-fp-card-dark">
              <Search size={14} className="text-gray-400" />
              <input type="text" placeholder="Buscar archivo..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew placeholder-gray-400 dark:placeholder-fp-text-tertiary w-36" />
            </div>

            {/* Filter project */}
            <div className="relative">
              <button onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowClientFilterDropdown(false) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark">
                <Filter size={12} />
                {filterProject === 'all' ? 'Proyecto' : projects.find(p => p.id === filterProject)?.name || 'Proyecto'}
                <ChevronDown size={10} />
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 top-9 w-52 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                  <button onClick={() => { setFilterProject('all'); setShowFilterDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterProject === 'all' ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>Todos</button>
                  {projects.map(p => (<button key={p.id} onClick={() => { setFilterProject(p.id); setShowFilterDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterProject === p.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>{p.name}</button>))}
                </div>
              )}
            </div>

            {/* Filter client */}
            <div className="relative">
              <button onClick={() => { setShowClientFilterDropdown(!showClientFilterDropdown); setShowFilterDropdown(false) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark">
                {filterClient === 'all' ? 'Cliente' : clients.find(c => c.id === filterClient)?.name || 'Cliente'}
                <ChevronDown size={10} />
              </button>
              {showClientFilterDropdown && (
                <div className="absolute right-0 top-9 w-48 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                  <button onClick={() => { setFilterClient('all'); setShowClientFilterDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterClient === 'all' ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>Todos</button>
                  {clients.map(c => (<button key={c.id} onClick={() => { setFilterClient(c.id); setShowClientFilterDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterClient === c.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>{c.name}</button>))}
                </div>
              )}
            </div>

            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark outline-none">
              <option value="all">Tipo</option>
              <option value="image">Imágenes</option>
              <option value="video">Videos</option>
              <option value="document">Documentos</option>
              <option value="other">Otros</option>
            </select>

            <div className="flex border border-gray-200 dark:border-fp-border-dark rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400'}`}><List size={14} /></button>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400'}`}><Grid size={14} /></button>
            </div>

            <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-xs font-semibold hover:bg-fp-punch-red/20">
              <Upload size={13} /> Subir
            </button>
          </div>
        </div>
      </div>

      {/* ── UPLOAD PANEL ── */}
      {showUpload && (
        <div className="mx-8 mt-4 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Subir archivos a Drive</h3>
              <span className="flex items-center gap-1 text-xs text-fp-cerulean bg-fp-cerulean/10 px-2 py-0.5 rounded-md"><FolderSync size={11} /> Google Drive</span>
            </div>
            <button onClick={() => { setShowUpload(false); setUploadError(null) }} className="text-gray-400 hover:text-fp-punch-red"><X size={16} /></button>
          </div>

          {/* Tipo destino */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button onClick={() => { setUploadType('fee'); setUploadProjectId('') }} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left ${uploadType === 'fee' ? 'border-fp-cerulean bg-fp-cerulean/5' : 'border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean/30'}`}>
              <CalendarDays size={18} className={uploadType === 'fee' ? 'text-fp-cerulean' : 'text-gray-400'} />
              <div>
                <div className={`text-sm font-semibold ${uploadType === 'fee' ? 'text-fp-cerulean' : 'text-fp-navy dark:text-fp-honeydew'}`}>Fee Mensual</div>
                <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Contenido mensual</div>
              </div>
            </button>
            <button onClick={() => { setUploadType('project'); setUploadClientId('') }} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left ${uploadType === 'project' ? 'border-fp-cerulean bg-fp-cerulean/5' : 'border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean/30'}`}>
              <Briefcase size={18} className={uploadType === 'project' ? 'text-fp-cerulean' : 'text-gray-400'} />
              <div>
                <div className={`text-sm font-semibold ${uploadType === 'project' ? 'text-fp-cerulean' : 'text-fp-navy dark:text-fp-honeydew'}`}>Proyecto Específico</div>
                <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Trabajo puntual</div>
              </div>
            </button>
          </div>

          {/* Selectores */}
          {uploadType === 'fee' ? (
            <div className="space-y-3 mb-4">
              {/* Cliente */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Cliente</label>
                <div className="relative">
                  <button onClick={() => { setShowClientDropdown(!showClientDropdown); setShowProjectDropdown(false) }} className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew flex justify-between items-center">
                    <span>{selectedClient?.name || 'Seleccionar cliente...'}</span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                  {showClientDropdown && (
                    <div className="absolute left-0 top-10 w-full bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                      {clients.filter(c => c.drive_fee_folder_id).map(c => (
                        <button key={c.id} onClick={() => { setUploadClientId(c.id); setShowClientDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${uploadClientId === c.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>{c.name}</button>
                      ))}
                      {clients.filter(c => c.drive_fee_folder_id).length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No hay clientes con carpeta Drive.</p>}
                    </div>
                  )}
                </div>
              </div>
              {/* Año + Mes + Día */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Año</label>
                  <select value={uploadYear} onChange={e => setUploadYear(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Mes</label>
                  <select value={uploadMonth} onChange={e => setUploadMonth(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none">
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Día</label>
                  <select value={uploadDay} onChange={e => setUploadDay(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none">
                    {Array.from({ length: maxDays }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d.toString()}>{d} — {getDayName(yearNum, monthNum, d)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {uploadClientId && (
                <div className="bg-fp-cerulean/5 border border-fp-cerulean/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-fp-cerulean">📂 <span className="font-mono">{uploadYear}/{uploadYear}-{uploadMonth}_{MONTHS.find(m => m.value === uploadMonth)?.label}/{uploadDay.padStart(2, '0')}_{dayName}/</span></p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Cliente</label>
                <div className="relative">
                  <button onClick={() => { setShowClientDropdown(!showClientDropdown); setShowProjectDropdown(false) }} className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew flex justify-between items-center">
                    <span>{selectedClient?.name || 'Todos'}</span><ChevronDown size={14} className="text-gray-400" />
                  </button>
                  {showClientDropdown && (
                    <div className="absolute left-0 top-10 w-full bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                      <button onClick={() => { setUploadClientId(''); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark text-fp-navy dark:text-fp-honeydew">Todos</button>
                      {clients.map(c => (<button key={c.id} onClick={() => { setUploadClientId(c.id); setUploadProjectId(''); setShowClientDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${uploadClientId === c.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>{c.name}</button>))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Proyecto</label>
                <div className="relative">
                  <button onClick={() => { setShowProjectDropdown(!showProjectDropdown); setShowClientDropdown(false) }} className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew flex justify-between items-center">
                    <span>{projects.find(p => p.id === uploadProjectId)?.name || 'Seleccionar...'}</span><ChevronDown size={14} className="text-gray-400" />
                  </button>
                  {showProjectDropdown && (
                    <div className="absolute left-0 top-10 w-full bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                      {(uploadClientId ? clientProjects : projects.filter(p => p.drive_folder_id)).map(p => (
                        <button key={p.id} onClick={() => { setUploadProjectId(p.id); setShowProjectDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${uploadProjectId === p.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>{p.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Nomenclatura */}
          <div className="mb-4 border border-gray-200 dark:border-fp-border-dark rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Tag size={14} className="text-fp-cerulean flex-shrink-0" />
                <span className="text-sm font-medium text-fp-navy dark:text-fp-honeydew whitespace-nowrap">Nomenclatura</span>
              </div>
              <button onClick={() => setForceNaming(!forceNaming)} className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${forceNaming ? 'bg-fp-cerulean' : 'bg-gray-300 dark:bg-fp-border-dark'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${forceNaming ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {forceNaming && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Nombre</label>
                    <input type="text" value={namingDesc} onChange={e => setNamingDesc(e.target.value)} placeholder="Ej: PostNavidad" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Estado</label>
                    <select value={namingStatus} onChange={e => setNamingStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none">
                      {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Versión</label>
                    <input type="number" min={1} value={namingVersion} onChange={e => setNamingVersion(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none font-mono" />
                  </div>
                </div>
                {namingDesc.trim() && (
                  <div className="bg-fp-bg-dark/50 dark:bg-fp-bg-dark rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">Preview:</p>
                    <p className="text-xs font-mono text-fp-cerulean">{buildFileName('archivo.ext')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {uploadError && <div className="mb-4 px-3 py-2 rounded-lg bg-fp-punch-red/10 border border-fp-punch-red/20 text-xs text-fp-punch-red">{uploadError}</div>}

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-6 cursor-pointer hover:border-fp-cerulean transition-colors">
            {uploading ? <Loader2 size={28} className="text-fp-cerulean animate-spin mb-2" /> : <Upload size={28} className="text-gray-400 mb-2" />}
            <p className="text-sm text-fp-navy dark:text-fp-honeydew font-medium">{uploading ? 'Subiendo a Drive...' : 'Hacé click o arrastrá archivos acá'}</p>
            <input type="file" multiple className="hidden" disabled={uploading} onChange={e => e.target.files && handleUpload(e.target.files)} />
          </label>
        </div>
      )}

      {/* ── BULK ACTIONS BAR ── */}
      {selectedIds.size > 0 && (
        <div className="mx-8 mt-4 bg-fp-cerulean/10 border border-fp-cerulean/20 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-fp-cerulean font-medium">{selectedIds.size} archivo{selectedIds.size > 1 ? 's' : ''} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => bulkToggleVisibility(true)} className="px-3 py-1.5 rounded-lg text-xs bg-fp-cerulean/10 text-fp-cerulean hover:bg-fp-cerulean/20 flex items-center gap-1"><Eye size={12} /> Visible</button>
            <button onClick={() => bulkToggleVisibility(false)} className="px-3 py-1.5 rounded-lg text-xs bg-fp-cerulean/10 text-fp-cerulean hover:bg-fp-cerulean/20 flex items-center gap-1"><EyeOff size={12} /> Ocultar</button>
            <button onClick={bulkDelete} className="px-3 py-1.5 rounded-lg text-xs bg-fp-punch-red/10 text-fp-punch-red hover:bg-fp-punch-red/20 flex items-center gap-1"><Trash2 size={12} /> Eliminar</button>
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-fp-hover-dark">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── FILE LIST ── */}
      <div className="p-8">
        {loading ? (
          <div className="text-center py-16"><p className="text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando archivos...</p></div>
        ) : filteredFiles.length === 0 ? (
          <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
            <FolderOpen size={40} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">{search ? 'Sin resultados' : 'No hay archivos todavía'}</h3>
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
            <div className="grid grid-cols-[32px_1fr_120px_80px_80px_60px_100px] gap-3 px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark text-xs text-gray-400 uppercase tracking-wider font-medium">
              <button onClick={toggleSelectAll} className="flex items-center justify-center">
                {selectedIds.size === filteredFiles.length && filteredFiles.length > 0 ? <CheckSquare size={14} className="text-fp-cerulean" /> : <Square size={14} />}
              </button>
              <span>Nombre</span><span>Proyecto</span><span>Tipo</span><span>Tamaño</span><span>Vis.</span><span className="text-right">Acciones</span>
            </div>
            {filteredFiles.map(file => {
              const IconComp = fileTypeIcons[file.file_type] || File
              const colorClass = fileTypeColors[file.file_type] || fileTypeColors.other
              const isSelected = selectedIds.has(file.id)
              return (
                <div key={file.id} className={`grid grid-cols-[32px_1fr_120px_80px_80px_60px_100px] gap-3 px-5 py-2.5 border-b border-gray-50 dark:border-fp-border-dark items-center hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors ${isSelected ? 'bg-fp-cerulean/5' : ''}`}>
                  <button onClick={() => toggleSelect(file.id)} className="flex items-center justify-center">
                    {isSelected ? <CheckSquare size={14} className="text-fp-cerulean" /> : <Square size={14} className="text-gray-400" />}
                  </button>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}><IconComp size={14} /></div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{file.name}</div>
                      <div className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">v{file.version} · {new Date(file.created_at).toLocaleDateString('es-AR')}{file.drive_file_id && <span className="ml-1 text-fp-cerulean">· Drive</span>}</div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-fp-text-secondary truncate">{file.projects?.name || '—'}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md w-fit ${colorClass}`}>{file.file_type}</span>
                  <span className="text-xs text-gray-400 font-mono">{formatSize(file.size_bytes)}</span>
                  <button onClick={() => toggleVisibility(file)} className={`p-1 rounded-md ${file.visible_to_client ? 'text-fp-cerulean bg-fp-cerulean/10' : 'text-gray-400 hover:text-fp-cerulean'}`}>{file.visible_to_client ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                  <div className="flex items-center gap-1 justify-end">
                    {file.url && <button onClick={() => window.open(file.url!, '_blank')} className="p-1 rounded-md text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10"><ExternalLink size={13} /></button>}
                    <button onClick={() => deleteFile(file)} className="p-1 rounded-md text-gray-400 hover:text-fp-punch-red hover:bg-fp-punch-red/10"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFiles.map(file => {
              const IconComp = fileTypeIcons[file.file_type] || File
              const colorClass = fileTypeColors[file.file_type] || fileTypeColors.other
              const thumbnailUrl = file.drive_file_id ? `https://drive.google.com/thumbnail?id=${file.drive_file_id}&sz=w400` : file.url
              const isImage = file.file_type === 'image' && (file.drive_file_id || file.url)
              const isSelected = selectedIds.has(file.id)
              return (
                <div key={file.id} className={`bg-white dark:bg-fp-card-dark border rounded-xl overflow-hidden hover:border-fp-cerulean/30 transition-colors group relative ${isSelected ? 'border-fp-cerulean' : 'border-gray-200 dark:border-fp-border-dark'}`}>
                  <button onClick={() => toggleSelect(file.id)} className="absolute top-2 left-2 z-10 p-1 rounded bg-black/30 text-white">
                    {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <div className="h-28 bg-gray-50 dark:bg-fp-hover-dark flex items-center justify-center relative">
                    {isImage ? <img src={thumbnailUrl!} alt={file.name} className="w-full h-full object-cover" /> : <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}><IconComp size={20} /></div>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {file.url && <button onClick={() => window.open(file.url!, '_blank')} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20"><ExternalLink size={14} /></button>}
                      <button onClick={() => deleteFile(file)} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-fp-punch-red/50"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-medium text-fp-navy dark:text-fp-honeydew truncate">{file.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400">{formatSize(file.size_bytes)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${colorClass}`}>{file.file_type}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
