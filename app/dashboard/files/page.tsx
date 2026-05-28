'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Upload,
  FolderOpen,
  File,
  Image,
  Film,
  FileText,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Search,
  Filter,
  Grid,
  List,
  X,
  ChevronDown,
  FolderSync,
  Loader2,
  CalendarDays,
  Briefcase,
  Tag,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────

type FileRecord = {
  id: string
  name: string
  file_type: string
  storage_path: string | null
  drive_file_id: string | null
  url: string | null
  size_bytes: number | null
  mime_type: string | null
  visible_to_client: boolean
  category: string | null
  version: number
  created_at: string
  project_id: string
  projects?: { name: string; clients?: { name: string } | null } | null
}

type Project = {
  id: string
  name: string
  drive_folder_id: string | null
  client_id: string | null
  clients: { name: string } | null
}

type ClientRecord = {
  id: string
  name: string
  drive_folder_id: string | null
  drive_fee_folder_id: string | null
}

type DriveFolder = {
  id: string
  name: string
}

// ─── Constantes ───────────────────────────────────────────────────────

const MONTHS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const STATUS_OPTIONS = [
  { value: '_WIP', label: 'WIP', desc: 'Work In Progress — Borrador, no listo' },
  { value: '_REV', label: 'REV', desc: 'Revisión — Para que lo vea el PM o Socio' },
  { value: '_FIN', label: 'FIN', desc: 'Final — Aprobado internamente' },
  { value: '_OK', label: 'OK', desc: 'Aprobado Cliente — Versión definitiva' },
]

const fileTypeIcons: Record<string, typeof File> = {
  image: Image,
  video: Film,
  document: FileText,
  image_360: Image,
  other: File,
}

const fileTypeColors: Record<string, string> = {
  image: 'text-emerald-400 bg-emerald-400/10',
  video: 'text-purple-400 bg-purple-400/10',
  document: 'text-fp-cerulean bg-fp-cerulean/10',
  image_360: 'text-amber-400 bg-amber-400/10',
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
  if (
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('text') ||
    mime.includes('sheet') ||
    mime.includes('presentation')
  )
    return 'document'
  return 'other'
}

function getFileExtension(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? '.' + parts.pop() : ''
}

// ─── Componente ───────────────────────────────────────────────────────

export default function FilesPage() {
  const supabase = createClient()

  // ── Estado: lista de archivos ──
  const [files, setFiles] = useState<FileRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // ── Estado: panel de upload ──
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // ── Estado: flujo de destino ──
  const [uploadType, setUploadType] = useState<'fee' | 'project'>('project')
  const [uploadClientId, setUploadClientId] = useState('')
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear().toString())
  const [uploadMonth, setUploadMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'))

  // ── Estado: nomenclatura ──
  const [forceNaming, setForceNaming] = useState(false)
  const [namingDesc, setNamingDesc] = useState('')
  const [namingStatus, setNamingStatus] = useState('_WIP')
  const [namingVersion, setNamingVersion] = useState(1)

  // ── Estado: dropdowns ──
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  // ── Fetch data ─────────────────────────────────────────────────────

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('files')
      .select('*, projects(name, clients(name))')
      .order('created_at', { ascending: false })

    if (filterProject !== 'all') {
      query = query.eq('project_id', filterProject)
    }
    if (filterType !== 'all') {
      query = query.eq('file_type', filterType)
    }

    const { data } = await query
    setFiles(data || [])
    setLoading(false)
  }, [filterProject, filterType])

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name, drive_folder_id, client_id, clients(name)')
      .order('name')
    setProjects((data as unknown as Project[]) || [])
  }

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name, drive_folder_id, drive_fee_folder_id')
      .order('name')
    setClients((data as unknown as ClientRecord[]) || [])
  }

  useEffect(() => {
    fetchFiles()
    fetchProjects()
    fetchClients()
  }, [fetchFiles])

  // ── Helpers ────────────────────────────────────────────────────────

  const selectedClient = clients.find(c => c.id === uploadClientId)
  const clientProjects = projects.filter(p => p.client_id === uploadClientId && p.drive_folder_id)

  function buildFileName(originalName: string): string {
    if (!forceNaming || !namingDesc.trim()) return originalName

    const ext = getFileExtension(originalName)
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    const clientName = selectedClient?.name.replace(/\s+/g, '') || 'Cliente'

    return `${dateStr}_${clientName}_${namingDesc.trim().replace(/\s+/g, '')}${namingStatus}_v${namingVersion}${ext}`
  }

  async function resolveTargetFolderId(): Promise<string | null> {
    if (uploadType === 'project') {
      const proj = projects.find(p => p.id === uploadProjectId)
      return proj?.drive_folder_id || null
    }

    // Fee Mensual — construir path: year → AAAA-MM_Mes → DD_Dia
    if (!selectedClient?.drive_fee_folder_id) return null

    const monthLabel = MONTHS.find(m => m.value === uploadMonth)?.label || 'Mes'
    const today = new Date()
    const dayNum = today.getDate().toString().padStart(2, '0')
    const dayName = DAY_NAMES[today.getDay()]

    const pathSegments = [
      uploadYear,
      `${uploadYear}-${uploadMonth}_${monthLabel}`,
      `${dayNum}_${dayName}`,
    ]

    try {
      const res = await fetch('/api/drive/ensure-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentFolderId: selectedClient.drive_fee_folder_id,
          pathSegments,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data.folderId
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error creando ruta de carpetas'
      setUploadError(msg)
      return null
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────

  const handleUpload = async (fileList: FileList) => {
    setUploadError(null)

    // Validaciones
    if (uploadType === 'project' && !uploadProjectId) {
      setUploadError('Seleccioná un proyecto primero')
      return
    }
    if (uploadType === 'fee' && !uploadClientId) {
      setUploadError('Seleccioná un cliente primero')
      return
    }
    if (uploadType === 'fee' && !selectedClient?.drive_fee_folder_id) {
      setUploadError('Este cliente no tiene carpeta de Fee Mensual en Drive. Recreá el cliente o asigná la carpeta manualmente.')
      return
    }
    if (forceNaming && !namingDesc.trim()) {
      setUploadError('Ingresá un nombre descriptivo para el archivo')
      return
    }

    setUploading(true)

    // Obtener provider_token
    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token
    if (!providerToken) {
      setUploadError('No hay token de Google. Cerrá sesión y volvé a entrar.')
      setUploading(false)
      return
    }

    // Resolver carpeta destino
    const targetFolderId = await resolveTargetFolderId()
    if (!targetFolderId) {
      if (!uploadError) setUploadError('No se pudo determinar la carpeta destino en Drive')
      setUploading(false)
      return
    }

    // Determinar project_id para Supabase
    let projectIdForDb = uploadType === 'project' ? uploadProjectId : null

    // Para fee, buscar o crear un proyecto "placeholder" no es necesario,
    // pero files requiere project_id. Usamos el primer proyecto del cliente si existe.
    if (uploadType === 'fee' && !projectIdForDb) {
      const clientProj = projects.find(p => p.client_id === uploadClientId)
      projectIdForDb = clientProj?.id || null
    }

    let currentVersion = namingVersion

    for (const file of Array.from(fileList)) {
      const finalName = forceNaming ? buildFileName(file.name) : file.name

      // Crear un nuevo File con el nombre modificado si forzamos nomenclatura
      const uploadFile = forceNaming
        ? new window.File([file], finalName, { type: file.type })
        : file

      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('parentFolderId', targetFolderId)
      formData.append('providerToken', providerToken)

      const res = await fetch('/api/drive/upload-file', {
        method: 'POST',
        body: formData,
      })

      const driveData = await res.json()

      if (!res.ok) {
        setUploadError(`Error al subir "${file.name}": ${driveData.error}`)
        continue
      }

      const fileType = detectFileType(file.type)

      if (projectIdForDb) {
        await supabase.from('files').insert({
          project_id: projectIdForDb,
          name: finalName,
          file_type: fileType,
          drive_file_id: driveData.fileId,
          url: driveData.webViewLink,
          size_bytes: driveData.size || file.size,
          mime_type: file.type,
          visible_to_client: false,
          version: forceNaming ? currentVersion : 1,
          storage_path: null,
        })
      }

      // Auto-incrementar versión para el siguiente archivo
      if (forceNaming) currentVersion++
    }

    setUploading(false)
    setShowUpload(false)
    setForceNaming(false)
    setNamingDesc('')
    setNamingVersion(1)
    fetchFiles()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) {
      if (!showUpload) setShowUpload(true)
      handleUpload(e.dataTransfer.files)
    }
  }

  const toggleVisibility = async (file: FileRecord) => {
    await supabase
      .from('files')
      .update({ visible_to_client: !file.visible_to_client })
      .eq('id', file.id)
    fetchFiles()
  }

  const deleteFile = async (file: FileRecord) => {
    if (!confirm(`¿Eliminar "${file.name}"?`)) return

    if (file.drive_file_id) {
      const { data: { session } } = await supabase.auth.getSession()
      const providerToken = session?.provider_token
      if (providerToken) {
        await fetch('/api/drive/delete-file', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: file.drive_file_id, providerToken }),
        })
      }
    }

    if (file.storage_path) {
      await supabase.storage.from('project-files').remove([file.storage_path])
    }

    await supabase.from('files').delete().eq('id', file.id)
    fetchFiles()
  }

  const openFile = (file: FileRecord) => {
    if (file.url) window.open(file.url, '_blank')
  }

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalSize = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0)

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen"
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragActive && (
        <div className="fixed inset-0 z-50 bg-fp-bg-dark/80 flex items-center justify-center">
          <div className="border-2 border-dashed border-fp-cerulean rounded-2xl p-16 text-center">
            <Upload size={48} className="text-fp-cerulean mx-auto mb-4" />
            <p className="text-fp-honeydew text-lg font-semibold">Soltá los archivos acá</p>
            <p className="text-fp-text-tertiary text-sm mt-1">Se suben al destino seleccionado</p>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">Archivos</h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {files.length} archivos · {formatSize(totalSize)} total · almacenados en Drive
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm bg-white dark:bg-fp-card-dark">
              <Search size={14} className="text-gray-400 dark:text-fp-text-secondary" />
              <input
                type="text"
                placeholder="Buscar archivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew placeholder-gray-400 dark:placeholder-fp-text-tertiary w-40"
              />
            </div>

            {/* Filter by project */}
            <div className="relative">
              <button
                onClick={() => { setShowFilterDropdown(!showFilterDropdown) }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm text-gray-500 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark"
              >
                <Filter size={14} />
                {filterProject === 'all' ? 'Todos los proyectos' : projects.find(p => p.id === filterProject)?.name || 'Proyecto'}
                <ChevronDown size={12} />
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 top-10 w-56 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { setFilterProject('all'); setShowFilterDropdown(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterProject === 'all' ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}
                  >
                    Todos los proyectos
                  </button>
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setFilterProject(p.id); setShowFilterDropdown(false) }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterProject === p.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}
                    >
                      {p.name}
                      {p.clients?.name && (
                        <span className="text-xs text-gray-400 dark:text-fp-text-tertiary ml-2">{p.clients.name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter by type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm text-gray-500 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark outline-none"
            >
              <option value="all">Todos los tipos</option>
              <option value="image">Imágenes</option>
              <option value="video">Videos</option>
              <option value="document">Documentos</option>
              <option value="other">Otros</option>
            </select>

            {/* View toggle */}
            <div className="flex border border-gray-200 dark:border-fp-border-dark rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 ${viewMode === 'list' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 dark:text-fp-text-tertiary hover:bg-gray-50 dark:hover:bg-fp-hover-dark'}`}
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 ${viewMode === 'grid' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 dark:text-fp-text-tertiary hover:bg-gray-50 dark:hover:bg-fp-hover-dark'}`}
              >
                <Grid size={16} />
              </button>
            </div>

            {/* Upload button */}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-sm font-semibold hover:bg-fp-punch-red/20 transition-colors"
            >
              <Upload size={14} /> Subir archivos
            </button>
          </div>
        </div>
      </div>

      {/* ── UPLOAD PANEL ── */}
      {showUpload && (
        <div className="mx-8 mt-4 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-6">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Subir archivos a Drive</h3>
              <span className="flex items-center gap-1 text-xs text-fp-cerulean bg-fp-cerulean/10 px-2 py-0.5 rounded-md">
                <FolderSync size={11} /> Google Drive
              </span>
            </div>
            <button
              onClick={() => { setShowUpload(false); setUploadError(null) }}
              className="text-gray-400 dark:text-fp-text-tertiary hover:text-fp-punch-red"
            >
              <X size={16} />
            </button>
          </div>

          {/* ─ Tipo de destino ─ */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-2 block">¿Dónde va este archivo?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setUploadType('fee'); setUploadProjectId('') }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                  uploadType === 'fee'
                    ? 'border-fp-cerulean bg-fp-cerulean/5'
                    : 'border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean/30'
                }`}
              >
                <CalendarDays size={20} className={uploadType === 'fee' ? 'text-fp-cerulean' : 'text-gray-400 dark:text-fp-text-tertiary'} />
                <div>
                  <div className={`text-sm font-semibold ${uploadType === 'fee' ? 'text-fp-cerulean' : 'text-fp-navy dark:text-fp-honeydew'}`}>
                    Fee Mensual
                  </div>
                  <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Contenido mensual del cliente</div>
                </div>
              </button>
              <button
                onClick={() => { setUploadType('project'); setUploadClientId('') }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                  uploadType === 'project'
                    ? 'border-fp-cerulean bg-fp-cerulean/5'
                    : 'border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean/30'
                }`}
              >
                <Briefcase size={20} className={uploadType === 'project' ? 'text-fp-cerulean' : 'text-gray-400 dark:text-fp-text-tertiary'} />
                <div>
                  <div className={`text-sm font-semibold ${uploadType === 'project' ? 'text-fp-cerulean' : 'text-fp-navy dark:text-fp-honeydew'}`}>
                    Proyecto Específico
                  </div>
                  <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Trabajo puntual fuera del fee</div>
                </div>
              </button>
            </div>
          </div>

          {/* ─ Selectores según tipo ─ */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {uploadType === 'fee' ? (
              <>
                {/* Cliente */}
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Cliente</label>
                  <div className="relative">
                    <button
                      onClick={() => { setShowClientDropdown(!showClientDropdown); setShowProjectDropdown(false) }}
                      className="w-full text-left px-4 py-2.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew flex justify-between items-center"
                    >
                      <span>{selectedClient?.name || 'Seleccionar cliente...'}</span>
                      <ChevronDown size={14} className="text-gray-400" />
                    </button>
                    {showClientDropdown && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                        {clients.filter(c => c.drive_fee_folder_id).map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setUploadClientId(c.id); setShowClientDropdown(false) }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${uploadClientId === c.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}
                          >
                            {c.name}
                          </button>
                        ))}
                        {clients.filter(c => c.drive_fee_folder_id).length === 0 && (
                          <p className="px-4 py-3 text-sm text-gray-400 dark:text-fp-text-tertiary">
                            No hay clientes con carpeta Drive. Crealos primero.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Año */}
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Año</label>
                  <select
                    value={uploadYear}
                    onChange={(e) => setUploadYear(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Mes */}
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Mes</label>
                  <select
                    value={uploadMonth}
                    onChange={(e) => setUploadMonth(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Info de ruta */}
                {uploadClientId && (
                  <div className="col-span-2 bg-fp-cerulean/5 border border-fp-cerulean/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-fp-cerulean">
                      📂 Se crea automáticamente: <span className="font-mono">{uploadYear}/{uploadYear}-{uploadMonth}_{MONTHS.find(m => m.value === uploadMonth)?.label}/{new Date().getDate().toString().padStart(2, '0')}_{DAY_NAMES[new Date().getDay()]}/</span>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Cliente (para filtrar proyectos) */}
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Cliente</label>
                  <div className="relative">
                    <button
                      onClick={() => { setShowClientDropdown(!showClientDropdown); setShowProjectDropdown(false) }}
                      className="w-full text-left px-4 py-2.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew flex justify-between items-center"
                    >
                      <span>{selectedClient?.name || 'Todos los clientes'}</span>
                      <ChevronDown size={14} className="text-gray-400" />
                    </button>
                    {showClientDropdown && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                        <button
                          onClick={() => { setUploadClientId(''); setShowClientDropdown(false) }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${!uploadClientId ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}
                        >
                          Todos los clientes
                        </button>
                        {clients.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setUploadClientId(c.id); setUploadProjectId(''); setShowClientDropdown(false) }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${uploadClientId === c.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Proyecto */}
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Proyecto destino</label>
                  <div className="relative">
                    <button
                      onClick={() => { setShowProjectDropdown(!showProjectDropdown); setShowClientDropdown(false) }}
                      className="w-full text-left px-4 py-2.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew flex justify-between items-center"
                    >
                      <span>{projects.find(p => p.id === uploadProjectId)?.name || 'Seleccionar proyecto...'}</span>
                      <div className="flex items-center gap-2">
                        {uploadProjectId && projects.find(p => p.id === uploadProjectId)?.drive_folder_id ? (
                          <span className="text-xs text-fp-cerulean">Drive ✓</span>
                        ) : uploadProjectId ? (
                          <span className="text-xs text-amber-400">Sin carpeta</span>
                        ) : null}
                        <ChevronDown size={14} className="text-gray-400" />
                      </div>
                    </button>
                    {showProjectDropdown && (
                      <div className="absolute left-0 top-12 w-full bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                        {(uploadClientId ? clientProjects : projects.filter(p => p.drive_folder_id)).map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setUploadProjectId(p.id); setShowProjectDropdown(false) }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark flex justify-between ${uploadProjectId === p.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}
                          >
                            <span>{p.name}</span>
                            {p.clients?.name && (
                              <span className="text-xs text-gray-400 dark:text-fp-text-tertiary">{p.clients.name}</span>
                            )}
                          </button>
                        ))}
                        {(uploadClientId ? clientProjects : projects.filter(p => p.drive_folder_id)).length === 0 && (
                          <p className="px-4 py-3 text-sm text-gray-400 dark:text-fp-text-tertiary">
                            No hay proyectos con carpeta Drive.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─ Nomenclatura ─ */}
          <div className="mb-4 border border-gray-200 dark:border-fp-border-dark rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-fp-cerulean" />
                <span className="text-sm font-medium text-fp-navy dark:text-fp-honeydew">Nomenclatura Feel Pixel</span>
              </div>
              <button
                onClick={() => setForceNaming(!forceNaming)}
                className={`relative w-10 h-5 rounded-full transition-colors ${forceNaming ? 'bg-fp-cerulean' : 'bg-gray-300 dark:bg-fp-border-dark'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${forceNaming ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {forceNaming && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {/* Nombre descriptivo */}
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Nombre descriptivo</label>
                    <input
                      type="text"
                      value={namingDesc}
                      onChange={e => setNamingDesc(e.target.value)}
                      placeholder="Ej: PostNavidad"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                    />
                  </div>

                  {/* Estado */}
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Estado</label>
                    <select
                      value={namingStatus}
                      onChange={e => setNamingStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>
                      ))}
                    </select>
                  </div>

                  {/* Versión */}
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Versión</label>
                    <input
                      type="number"
                      min={1}
                      value={namingVersion}
                      onChange={e => setNamingVersion(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean font-mono"
                    />
                  </div>
                </div>

                {/* Preview del nombre */}
                {namingDesc.trim() && (
                  <div className="bg-fp-bg-dark/50 dark:bg-fp-bg-dark rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mb-0.5">Preview del nombre:</p>
                    <p className="text-xs font-mono text-fp-cerulean">
                      {buildFileName('archivo.psd')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {uploadError && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-fp-punch-red/10 border border-fp-punch-red/20 text-xs text-fp-punch-red">
              {uploadError}
            </div>
          )}

          {/* Drop zone */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-8 cursor-pointer hover:border-fp-cerulean transition-colors">
            {uploading ? (
              <Loader2 size={32} className="text-fp-cerulean animate-spin mb-3" />
            ) : (
              <Upload size={32} className="text-gray-400 dark:text-fp-text-tertiary mb-3" />
            )}
            <p className="text-sm text-fp-navy dark:text-fp-honeydew font-medium">
              {uploading ? 'Subiendo a Drive...' : 'Hacé click o arrastrá archivos acá'}
            </p>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-1">
              Cualquier tipo de archivo · Se guardan en la carpeta seleccionada en Drive
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>
        </div>
      )}

      {/* ── FILE LIST ── */}
      <div className="p-8">
        {loading ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando archivos...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
            <FolderOpen size={40} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">
              {search ? 'Sin resultados' : 'No hay archivos todavía'}
            </h3>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary">
              {search
                ? `No se encontraron archivos para "${search}"`
                : 'Subí tu primer archivo con el botón de arriba'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          /* LIST VIEW */
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_140px_100px_100px_80px_120px] gap-4 px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark text-xs text-gray-400 dark:text-fp-text-tertiary uppercase tracking-wider font-medium">
              <span>Nombre</span>
              <span>Proyecto</span>
              <span>Tipo</span>
              <span>Tamaño</span>
              <span>Cliente</span>
              <span className="text-right">Acciones</span>
            </div>
            {filteredFiles.map(file => {
              const IconComp = fileTypeIcons[file.file_type] || File
              const colorClass = fileTypeColors[file.file_type] || fileTypeColors.other
              return (
                <div
                  key={file.id}
                  className="grid grid-cols-[1fr_140px_100px_100px_80px_120px] gap-4 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark items-center hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <IconComp size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">
                        v{file.version} · {new Date(file.created_at).toLocaleDateString('es-AR')}
                        {file.drive_file_id && (
                          <span className="ml-1 text-fp-cerulean">· Drive</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-fp-text-secondary truncate">
                    {file.projects?.name || '—'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-md w-fit ${colorClass}`}>
                    {file.file_type}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-fp-text-tertiary font-mono">
                    {formatSize(file.size_bytes)}
                  </span>
                  <div>
                    <button
                      onClick={() => toggleVisibility(file)}
                      className={`p-1 rounded-md transition-colors ${
                        file.visible_to_client
                          ? 'text-fp-cerulean bg-fp-cerulean/10 hover:bg-fp-cerulean/20'
                          : 'text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10'
                      }`}
                      title={file.visible_to_client ? 'Visible para el cliente' : 'Oculto para el cliente'}
                    >
                      {file.visible_to_client ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    {file.url && (
                      <button
                        onClick={() => openFile(file)}
                        className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors"
                        title="Abrir en Drive"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteFile(file)}
                      className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* GRID VIEW */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredFiles.map(file => {
              const IconComp = fileTypeIcons[file.file_type] || File
              const colorClass = fileTypeColors[file.file_type] || fileTypeColors.other
              const isImage = file.file_type === 'image' && file.url
              return (
                <div
                  key={file.id}
                  className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden hover:border-fp-cerulean/30 transition-colors group"
                >
                  {/* Preview */}
                  <div className="h-32 bg-gray-50 dark:bg-fp-hover-dark flex items-center justify-center relative">
                    {isImage ? (
                      <img src={file.url!} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
                        <IconComp size={24} />
                      </div>
                    )}
                    {/* Actions overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {file.url && (
                        <button
                          onClick={() => openFile(file)}
                          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
                          title="Abrir en Drive"
                        >
                          <ExternalLink size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => toggleVisibility(file)}
                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
                      >
                        {file.visible_to_client ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => deleteFile(file)}
                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-fp-punch-red/50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <div className="text-xs font-medium text-fp-navy dark:text-fp-honeydew truncate">
                      {file.name}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">
                        {formatSize(file.size_bytes)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${colorClass}`}>
                        {file.file_type}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-fp-text-tertiary mt-1 truncate">
                      {file.projects?.name}
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
