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
  Download,
  Eye,
  EyeOff,
  Search,
  Filter,
  Grid,
  List,
  X,
  ChevronDown,
} from 'lucide-react'

type FileRecord = {
  id: string
  name: string
  file_type: string
  storage_path: string | null
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
  clients: { name: string } | null
}

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

const categoryLabels: Record<string, string> = {
  photo: 'Foto',
  document: 'Documento',
  video: 'Video',
  invoice: 'Factura',
  special_request: 'Pedido especial',
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

export default function FilesPage() {
  const supabase = createClient()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [showUpload, setShowUpload] = useState(false)
  const [uploadProject, setUploadProject] = useState<string>('')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

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
      .select('id, name, clients(name)')
      .order('name')
setProjects((data as unknown as Project[]) || [])
    if (data && data.length > 0 && !uploadProject) {
      setUploadProject(data[0].id)
    }
  }

  useEffect(() => {
    fetchFiles()
    fetchProjects()
  }, [fetchFiles])

  const handleUpload = async (fileList: FileList) => {
    if (!uploadProject) {
      alert('Seleccioná un proyecto primero')
      return
    }

    setUploading(true)

    for (const file of Array.from(fileList)) {
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${uploadProject}/${timestamp}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(path, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(path)

      const fileType = detectFileType(file.type)

      await supabase.from('files').insert({
        project_id: uploadProject,
        name: file.name,
        file_type: fileType,
        storage_path: path,
        url: urlData.publicUrl,
        size_bytes: file.size,
        mime_type: file.type,
        visible_to_client: false,
        version: 1,
      })
    }

    setUploading(false)
    setShowUpload(false)
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

    if (file.storage_path) {
      await supabase.storage.from('project-files').remove([file.storage_path])
    }
    await supabase.from('files').delete().eq('id', file.id)
    fetchFiles()
  }

  const downloadFile = async (file: FileRecord) => {
    if (file.storage_path) {
      const { data } = await supabase.storage
        .from('project-files')
        .createSignedUrl(file.storage_path, 60)
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank')
      }
    }
  }

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalSize = files.reduce((acc, f) => acc + (f.size_bytes || 0), 0)

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
            <p className="text-fp-text-tertiary text-sm mt-1">Se suben al proyecto seleccionado</p>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">
              Archivos
            </h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {files.length} archivos · {formatSize(totalSize)} total
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
                onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowProjectDropdown(false) }}
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
                        <span className="text-xs text-gray-400 dark:text-fp-text-tertiary ml-2">
                          {p.clients.name}
                        </span>
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
              <Upload size={14} />
              Subir archivos
            </button>
          </div>
        </div>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="mx-8 mt-4 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Subir archivos</h3>
            <button onClick={() => setShowUpload(false)} className="text-gray-400 dark:text-fp-text-tertiary hover:text-fp-punch-red">
              <X size={16} />
            </button>
          </div>

          {/* Project selector */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Proyecto destino</label>
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full text-left px-4 py-2.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew flex justify-between items-center"
              >
                {projects.find(p => p.id === uploadProject)?.name || 'Seleccionar proyecto...'}
                <ChevronDown size={14} className="text-gray-400" />
              </button>
              {showProjectDropdown && (
                <div className="absolute left-0 top-12 w-full bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-48 overflow-y-auto">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setUploadProject(p.id); setShowProjectDropdown(false) }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${uploadProject === p.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                  {projects.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400 dark:text-fp-text-tertiary">
                      No hay proyectos. Creá uno primero.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Drop zone */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-8 cursor-pointer hover:border-fp-cerulean transition-colors">
            <Upload size={32} className="text-gray-400 dark:text-fp-text-tertiary mb-3" />
            <p className="text-sm text-fp-navy dark:text-fp-honeydew font-medium">
              {uploading ? 'Subiendo...' : 'Hacé click o arrastrá archivos acá'}
            </p>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-1">
              Cualquier tipo de archivo · Máximo 50MB
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploading || !uploadProject}
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
          </label>
        </div>
      )}

      {/* Content */}
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
              {search ? `No se encontraron archivos para "${search}"` : 'Subí tu primer archivo con el botón de arriba'}
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
            {/* Rows */}
            {filteredFiles.map((file) => {
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
                    <button
                      onClick={() => downloadFile(file)}
                      className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors"
                      title="Descargar"
                    >
                      <Download size={14} />
                    </button>
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
            {filteredFiles.map((file) => {
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
                      <button
                        onClick={() => downloadFile(file)}
                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"
                      >
                        <Download size={16} />
                      </button>
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
