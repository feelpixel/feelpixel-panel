'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  DollarSign,
  Users,
  FolderOpen,
  File,
  Image,
  Film,
  FileText,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Github,
  Upload,
  X,
  ChevronDown,
  FolderSync,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  drive_folder_id: string | null
  github_repo_url: string | null
  created_at: string
  client_id: string | null
  clients?: { id: string; name: string } | null
}

type Task = {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  assignee_id: string | null
  profiles?: { full_name: string | null } | null
}

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
  version: number
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Borrador',   bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10',  text: 'text-gray-500 dark:text-fp-text-tertiary' },
  active:    { label: 'Activo',     bg: 'bg-fp-cerulean/10',                         text: 'text-fp-cerulean' },
  paused:    { label: 'Pausado',    bg: 'bg-amber-500/10',                           text: 'text-amber-500' },
  completed: { label: 'Completado', bg: 'bg-fp-frosted/10',                          text: 'text-fp-frosted' },
  archived:  { label: 'Archivado',  bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10',  text: 'text-gray-400 dark:text-fp-text-tertiary' },
}

const taskStatusConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  todo:        { label: 'Pendiente',   icon: <Circle size={14} className="text-gray-400" /> },
  in_progress: { label: 'En proceso',  icon: <Clock size={14} className="text-amber-400" /> },
  review:      { label: 'En revisión', icon: <AlertCircle size={14} className="text-fp-cerulean" /> },
  done:        { label: 'Listo',       icon: <CheckCircle2 size={14} className="text-emerald-400" /> },
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-fp-punch-red',
  high:   'bg-amber-500',
  medium: 'bg-fp-cerulean',
  low:    'bg-gray-400 dark:bg-fp-text-tertiary',
}

const fileTypeIcons: Record<string, typeof File> = {
  image: Image, video: Film, document: FileText, other: File,
}

const fileTypeColors: Record<string, string> = {
  image:    'text-emerald-400 bg-emerald-400/10',
  video:    'text-purple-400 bg-purple-400/10',
  document: 'text-fp-cerulean bg-fp-cerulean/10',
  other:    'text-fp-text-secondary bg-fp-text-secondary/10',
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'tasks'>('overview')

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProject = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*, clients(id, name)')
      .eq('id', projectId)
      .single()
    setProject(data)
  }

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, profiles(full_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setTasks(data || [])
  }

  const fetchFiles = async () => {
    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    setFiles(data || [])
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchProject(), fetchTasks(), fetchFiles()])
      setLoading(false)
    }
    init()
  }, [projectId])

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUpload = async (fileList: FileList) => {
    setUploadError(null)

    if (!project?.drive_folder_id) {
      setUploadError('Este proyecto no tiene carpeta en Drive. Creá el proyecto nuevamente para generar la carpeta.')
      return
    }

    setUploading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token

    if (!providerToken) {
      setUploadError('No hay token de Google. Cerrá sesión y volvé a entrar.')
      setUploading(false)
      return
    }

    for (const file of Array.from(fileList)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('parentFolderId', project.drive_folder_id)
      formData.append('providerToken', providerToken)

      const res = await fetch('/api/drive/upload-file', { method: 'POST', body: formData })
      const driveData = await res.json()

      if (!res.ok) {
        setUploadError(`Error al subir "${file.name}": ${driveData.error}`)
        continue
      }

      await supabase.from('files').insert({
        project_id: projectId,
        name: file.name,
        file_type: detectFileType(file.type),
        drive_file_id: driveData.fileId,
        url: driveData.webViewLink,
        size_bytes: driveData.size || file.size,
        mime_type: file.type,
        visible_to_client: false,
        version: 1,
        storage_path: null,
      })
    }

    setUploading(false)
    setShowUpload(false)
    fetchFiles()
  }

  // ── Acciones archivos ──────────────────────────────────────────────────────

  const toggleVisibility = async (file: FileRecord) => {
    await supabase.from('files').update({ visible_to_client: !file.visible_to_client }).eq('id', file.id)
    fetchFiles()
  }

  const deleteFile = async (file: FileRecord) => {
    if (!confirm(`¿Eliminar "${file.name}"?`)) return
    if (file.drive_file_id) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) {
        await fetch('/api/drive/delete-file', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: file.drive_file_id, providerToken: session.provider_token }),
        })
      }
    }
    if (file.storage_path) {
      await supabase.storage.from('project-files').remove([file.storage_path])
    }
    await supabase.from('files').delete().eq('id', file.id)
    fetchFiles()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando proyecto...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-sm text-fp-navy dark:text-fp-honeydew font-semibold">Proyecto no encontrado</p>
        <Link href="/dashboard/projects" className="text-xs text-fp-cerulean hover:underline">
          ← Volver a proyectos
        </Link>
      </div>
    )
  }

  const status = statusConfig[project.status] || statusConfig.draft
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/projects"
            className="p-1.5 rounded-lg text-gray-400 dark:text-fp-text-tertiary hover:text-fp-navy dark:hover:text-fp-honeydew hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight truncate">
                {project.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${status.bg} ${status.text}`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {project.clients?.name
                ? <span className="flex items-center gap-1"><Users size={11} /> {project.clients.name}</span>
                : <span className="italic text-fp-cerulean">Proyecto interno</span>
              }
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {project.github_repo_url && (
              <a
                href={project.github_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean hover:text-fp-cerulean transition-colors"
              >
                <Github size={13} /> GitHub
              </a>
            )}
            {project.drive_folder_url && (
              <a
                href={project.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean hover:text-fp-cerulean transition-colors"
              >
                <ExternalLink size={13} /> Drive
              </a>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mt-4">
          {([
            { key: 'overview', label: 'Resumen' },
            { key: 'tasks',    label: `Tareas ${totalTasks > 0 ? `(${totalTasks})` : ''}` },
            { key: 'files',    label: `Archivos ${files.length > 0 ? `(${files.length})` : ''}` },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-fp-cerulean/10 text-fp-cerulean'
                  : 'text-gray-400 dark:text-fp-text-tertiary hover:bg-gray-100 dark:hover:bg-fp-hover-dark'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido por tab ── */}
      <div className="p-8">

        {/* ════ TAB: RESUMEN ════ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">

            {/* Columna izquierda — info principal */}
            <div className="col-span-2 space-y-4">

              {/* Descripción */}
              <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-3">
                  Descripción
                </h3>
                {project.description ? (
                  <p className="text-sm text-fp-navy dark:text-fp-honeydew leading-relaxed">
                    {project.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-fp-text-tertiary italic">
                    Sin descripción
                  </p>
                )}
              </div>

              {/* Progreso de tareas */}
              {totalTasks > 0 && (
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider">
                      Progreso
                    </h3>
                    <span className="text-xs text-fp-cerulean font-semibold">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 dark:bg-fp-hover-dark rounded-full overflow-hidden">
                    <div
                      className="h-full bg-fp-cerulean rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-2">
                    {doneTasks} de {totalTasks} tareas completadas
                  </p>
                </div>
              )}

              {/* Últimos archivos */}
              {files.length > 0 && (
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider">
                      Archivos recientes
                    </h3>
                    <button
                      onClick={() => setActiveTab('files')}
                      className="text-xs text-fp-cerulean hover:underline"
                    >
                      Ver todos →
                    </button>
                  </div>
                  {files.slice(0, 4).map(file => {
                    const IconComp = fileTypeIcons[file.file_type] || File
                    const colorClass = fileTypeColors[file.file_type] || fileTypeColors.other
                    return (
                      <div key={file.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark last:border-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <IconComp size={13} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-fp-navy dark:text-fp-honeydew truncate">{file.name}</div>
                          <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">
                            {formatSize(file.size_bytes)} · {new Date(file.created_at).toLocaleDateString('es-AR')}
                          </div>
                        </div>
                        {file.url && (
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-fp-cerulean">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Columna derecha — metadata */}
            <div className="space-y-4">

              {/* Detalles */}
              <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider">
                  Detalles
                </h3>

                {project.budget && (
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-gray-400 dark:text-fp-text-tertiary flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Presupuesto</div>
                      <div className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                        {project.currency} {project.budget.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {(project.start_date || project.due_date) && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400 dark:text-fp-text-tertiary flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Fechas</div>
                      <div className="text-sm text-fp-navy dark:text-fp-honeydew">
                        {project.start_date && new Date(project.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {project.start_date && project.due_date && ' → '}
                        {project.due_date && new Date(project.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                )}

                {project.clients && (
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-gray-400 dark:text-fp-text-tertiary flex-shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Cliente</div>
                      <div className="text-sm text-fp-navy dark:text-fp-honeydew">{project.clients.name}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <FolderOpen size={14} className="text-gray-400 dark:text-fp-text-tertiary flex-shrink-0" />
                  <div>
                    <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">Creado</div>
                    <div className="text-sm text-fp-navy dark:text-fp-honeydew">
                      {new Date(project.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats rápidos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-fp-cerulean">{totalTasks}</div>
                  <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">Tareas</div>
                </div>
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-fp-cerulean">{files.length}</div>
                  <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">Archivos</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ TAB: TAREAS ════ */}
        {activeTab === 'tasks' && (
          <div>
            <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
                <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Tareas del proyecto</h3>
                <span className="text-xs text-gray-400 dark:text-fp-text-tertiary">{totalTasks} tareas · {doneTasks} completadas</span>
              </div>
              {tasks.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <CheckCircle2 size={32} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-gray-400 dark:text-fp-text-tertiary">No hay tareas para este proyecto todavía</p>
                </div>
              ) : (
                tasks.map(task => {
                  const taskStatus = taskStatusConfig[task.status] || taskStatusConfig.todo
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 dark:border-fp-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColors[task.priority] || priorityColors.medium}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-fp-navy dark:text-fp-honeydew truncate">{task.title}</div>
                        {task.due_date && (
                          <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5 flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(task.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-fp-text-secondary flex-shrink-0">
                        {taskStatus.icon}
                        <span className="hidden sm:inline">{taskStatus.label}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ════ TAB: ARCHIVOS ════ */}
        {activeTab === 'files' && (
          <div>
            {/* Botón subir + panel upload */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-sm font-semibold hover:bg-fp-punch-red/20 transition-colors"
              >
                <Upload size={14} />
                Subir archivos
              </button>
            </div>

            {showUpload && (
              <div className="mb-4 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Subir archivos</h3>
                    <span className="flex items-center gap-1 text-xs text-fp-cerulean bg-fp-cerulean/10 px-2 py-0.5 rounded-md">
                      <FolderSync size={11} /> Google Drive
                    </span>
                  </div>
                  <button onClick={() => { setShowUpload(false); setUploadError(null) }} className="text-gray-400 hover:text-fp-punch-red">
                    <X size={16} />
                  </button>
                </div>
                {uploadError && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-fp-punch-red/10 border border-fp-punch-red/20 text-xs text-fp-punch-red">
                    {uploadError}
                  </div>
                )}
                {!project.drive_folder_id && (
                  <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
                    ⚠ Este proyecto no tiene carpeta en Drive asignada. Los archivos no se pueden subir hasta que el proyecto tenga carpeta.
                  </div>
                )}
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-8 cursor-pointer hover:border-fp-cerulean transition-colors">
                  <Upload size={32} className="text-gray-400 dark:text-fp-text-tertiary mb-3" />
                  <p className="text-sm text-fp-navy dark:text-fp-honeydew font-medium">
                    {uploading ? 'Subiendo a Drive...' : 'Hacé click o arrastrá archivos acá'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-1">
                    Se guardan en la carpeta Drive de este proyecto
                  </p>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    disabled={uploading || !project.drive_folder_id}
                    onChange={(e) => e.target.files && handleUpload(e.target.files)}
                  />
                </label>
              </div>
            )}

            {files.length === 0 ? (
              <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
                <FolderOpen size={40} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">No hay archivos todavía</h3>
                <p className="text-xs text-gray-400 dark:text-fp-text-tertiary">
                  Subí el primer archivo con el botón de arriba
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_100px_60px_100px] gap-4 px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark text-xs text-gray-400 dark:text-fp-text-tertiary uppercase tracking-wider font-medium">
                  <span>Nombre</span>
                  <span>Tipo</span>
                  <span>Tamaño</span>
                  <span>Cliente</span>
                  <span className="text-right">Acciones</span>
                </div>
                {files.map(file => {
                  const IconComp = fileTypeIcons[file.file_type] || File
                  const colorClass = fileTypeColors[file.file_type] || fileTypeColors.other
                  return (
                    <div
                      key={file.id}
                      className="grid grid-cols-[1fr_100px_100px_60px_100px] gap-4 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark items-center hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <IconComp size={13} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{file.name}</div>
                          <div className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">
                            v{file.version} · {new Date(file.created_at).toLocaleDateString('es-AR')}
                            {file.drive_file_id && <span className="ml-1 text-fp-cerulean">· Drive</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-md w-fit ${colorClass}`}>{file.file_type}</span>
                      <span className="text-xs text-gray-400 dark:text-fp-text-tertiary font-mono">{formatSize(file.size_bytes)}</span>
                      <button
                        onClick={() => toggleVisibility(file)}
                        className={`p-1 rounded-md transition-colors ${file.visible_to_client ? 'text-fp-cerulean bg-fp-cerulean/10' : 'text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean'}`}
                        title={file.visible_to_client ? 'Visible para cliente' : 'Oculto para cliente'}
                      >
                        {file.visible_to_client ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <div className="flex items-center gap-1 justify-end">
                        {file.url && (
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors" title="Abrir en Drive">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button onClick={() => deleteFile(file)} className="p-1.5 rounded-md text-gray-400 dark:text-fp-text-tertiary hover:text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
