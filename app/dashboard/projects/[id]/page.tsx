'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, ExternalLink, Calendar, Users, FolderOpen, File, Image, Film,
  FileText, Eye, EyeOff, Trash2, CheckCircle2, Clock, AlertCircle,
  Github, Upload, X, FolderSync, Tag, Loader2, Plus, Pencil, List, LayoutGrid,
  ChevronRight, Type, Palette, Layers, Link2,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

type Project = {
  id: string; name: string; description: string | null; status: string
  budget: number | null; currency: string; start_date: string | null
  due_date: string | null; drive_folder_url: string | null; drive_folder_id: string | null
  github_repo_url: string | null; created_at: string; client_id: string | null
  members: string[] | null
  clients?: { id: string; name: string; drive_folder_id: string | null; drive_fee_folder_id: string | null } | null
}
type KanbanColumn = { id: string; project_id: string; name: string; color: string; order: number }
type Task = {
  id: string; project_id: string; column_id: string | null; parent_task_id: string | null
  title: string; description: string | null; status: string; priority: string
  assignees: string[] | null; due_date: string | null; tags: string[] | null
  links: { url: string; label: string }[] | null; order: number; created_at: string
}
type FileRecord = {
  id: string; name: string; file_type: string; storage_path: string | null
  drive_file_id: string | null; url: string | null; size_bytes: number | null
  mime_type: string | null; visible_to_client: boolean; version: number; created_at: string
}
type Profile = { id: string; full_name: string | null; email: string }
type BrandColor = { id: string; client_id: string; name: string; hex: string }
type BrandFont = { id: string; client_id: string; name: string; type: string }

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '_WIP', label: 'WIP', desc: 'Work In Progress – Borrador, no listo' },
  { value: '_REV', label: 'REV', desc: 'Revisión – Para que lo vea el PM o Socio' },
  { value: '_FIN', label: 'FIN', desc: 'Final – Aprobado internamente' },
  { value: '_OK',  label: 'OK',  desc: 'Aprobado Cliente – Versión definitiva' },
]
const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Borrador',   bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10', text: 'text-gray-500 dark:text-fp-text-tertiary' },
  active:    { label: 'Activo',     bg: 'bg-fp-cerulean/10',                       text: 'text-fp-cerulean' },
  paused:    { label: 'Pausado',    bg: 'bg-amber-500/10',                          text: 'text-amber-500' },
  completed: { label: 'Completado', bg: 'bg-fp-frosted/10',                         text: 'text-fp-frosted' },
  archived:  { label: 'Archivado',  bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10',  text: 'text-gray-400' },
}
const priorityConfig: Record<string, { label: string; dot: string; border: string; bg: string }> = {
  urgent: { label: 'Urgente', dot: 'bg-fp-punch-red',  border: 'border-fp-punch-red/30',  bg: 'bg-fp-punch-red/10 text-fp-punch-red' },
  high:   { label: 'Alta',    dot: 'bg-amber-500',     border: 'border-amber-500/30',      bg: 'bg-amber-500/10 text-amber-500' },
  medium: { label: 'Media',   dot: 'bg-fp-cerulean',   border: 'border-fp-cerulean/30',    bg: 'bg-fp-cerulean/10 text-fp-cerulean' },
  low:    { label: 'Baja',    dot: 'bg-gray-400',      border: 'border-gray-300',          bg: 'bg-gray-100 text-gray-500' },
}
const fileTypeIcons: Record<string, typeof File> = { image: Image, video: Film, document: FileText, other: File }
const fileTypeColors: Record<string, string> = {
  image: 'text-emerald-400 bg-emerald-400/10', video: 'text-purple-400 bg-purple-400/10',
  document: 'text-fp-cerulean bg-fp-cerulean/10', other: 'text-fp-text-secondary bg-fp-text-secondary/10',
}
function formatSize(b: number | null) {
  if (!b) return '–'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}
function detectFileType(mime: string) {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || mime.includes('sheet') || mime.includes('presentation')) return 'document'
  return 'other'
}
function getExt(name: string) { const p = name.split('.'); return p.length > 1 ? '.' + p.pop() : '' }
function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ── DEFAULT COLUMNS – Feel Pixel workflow ────────────────────────────────────
const DEFAULT_COLUMNS = [
  { name: 'Presupuesto',      color: '#8a9bb5', order: 0 },
  { name: 'Pre-producción',   color: '#A8DADC', order: 1 },
  { name: 'Producción',       color: '#457B9D', order: 2 },
  { name: 'Post-Producción',  color: '#F59E0B', order: 3 },
  { name: 'Revisión',         color: '#E63946', order: 4 },
  { name: 'Finalizado',       color: '#10B981', order: 5 },
]

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
const labelCls = "text-xs text-gray-500 dark:text-fp-text-secondary block mb-1"

// ── ToggleSwitch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-fp-cerulean' : 'bg-gray-300 dark:bg-fp-border-dark'}`}
    >
      <span className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${on ? 'left-[22px]' : 'left-[2px]'}`} />
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [brandColors, setBrandColors] = useState<BrandColor[]>([])
  const [brandFonts, setBrandFonts] = useState<BrandFont[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'files' | 'branding'>('overview')

  // Edit project
  const [showEdit, setShowEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', status: '', start_date: '', due_date: '', github_repo_url: '' })

  // Tasks – Notion-style detail panel
  const [taskView, setTaskView] = useState<'list' | 'kanban'>('kanban')
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskDetail, setTaskDetail] = useState({
    title: '', description: '', priority: 'medium', due_date: '',
    column_id: '', tags: '', assignees: [] as string[],
    links: [] as { url: string; label: string }[],
  })
  const [savingDetail, setSavingDetail] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [renamingCol, setRenamingCol] = useState<string | null>(null)
  const [colRenameVal, setColRenameVal] = useState('')

  // Subtasks
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [loadingSubtasks, setLoadingSubtasks] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)

  // Links
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkLabel, setNewLinkLabel] = useState('')

  // Files
  const [fileMode, setFileMode] = useState<'project' | 'fee'>('project')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [forceNaming, setForceNaming] = useState(false)
  const [namingDesc, setNamingDesc] = useState('')
  const [namingStatus, setNamingStatus] = useState('_WIP')
  const [namingVersion, setNamingVersion] = useState(1)

  // Branding
  const [showColorForm, setShowColorForm] = useState(false)
  const [showFontForm, setShowFontForm] = useState(false)
  const [colorForm, setColorForm] = useState({ name: '', hex: '#457B9D' })
  const [fontForm, setFontForm] = useState({ name: '', type: 'sans' })
  const [brandingDriveFolders, setBrandingDriveFolders] = useState<{label: string; url: string | null; id: string | null}[]>([
    { label: 'Gráfica oficial',      url: null, id: null },
    { label: 'Fuentes cliente',      url: null, id: null },
    { label: 'Manual de Marca',      url: null, id: null },
    { label: 'Material del cliente', url: null, id: null },
  ])
  const [loadingBrandFolders, setLoadingBrandFolders] = useState(false)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchProject = async () => {
    const { data } = await supabase.from('projects').select('*, clients(id, name, drive_folder_id, drive_fee_folder_id)').eq('id', projectId).single()
    setProject(data)
    return data
  }

  const fetchColumns = async () => {
    const { data, error } = await supabase.from('kanban_columns').select('*').eq('project_id', projectId).order('order')
    if (error) { console.error('kanban_columns error:', error.message); return [] }
    return data || []
  }

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks').select('*').eq('project_id', projectId)
      .is('parent_task_id', null).order('order')
    if (error) {
      const { data: basic } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at')
      setTasks(basic || [])
    } else {
      setTasks(data || [])
    }
  }

  const fetchSubtasks = async (parentId: string) => {
    setLoadingSubtasks(true)
    const { data } = await supabase.from('tasks').select('*').eq('parent_task_id', parentId).order('created_at')
    setSubtasks(data || [])
    setLoadingSubtasks(false)
  }

  const fetchFiles = async () => {
    const { data } = await supabase.from('files').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    setFiles(data || [])
  }

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email')
    setProfiles(data || [])
  }

  const fetchBranding = async (clientId: string) => {
    const [colors, fonts] = await Promise.all([
      supabase.from('brand_colors').select('*').eq('client_id', clientId),
      supabase.from('brand_fonts').select('*').eq('client_id', clientId),
    ])
    setBrandColors(colors.data || [])
    setBrandFonts(fonts.data || [])
  }

  const fetchBrandingFolders = async (clientDriveFolderId: string) => {
    setLoadingBrandFolders(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/drive/get-onboarding-folders?folderId=${encodeURIComponent(clientDriveFolderId)}&providerToken=${encodeURIComponent(session?.provider_token || '')}`)
      if (res.ok) {
        const data = await res.json()
        if (data.folders) setBrandingDriveFolders(data.folders)
      }
    } catch { /* silencioso */ }
    setLoadingBrandFolders(false)
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const proj = await fetchProject()
      let cols = await fetchColumns()
      if (cols.length === 0) {
        const toInsert = DEFAULT_COLUMNS.map(c => ({ ...c, project_id: projectId }))
        const { data: newCols, error } = await supabase.from('kanban_columns').insert(toInsert).select()
        if (error) { console.error('Error creando columnas default:', error.message) }
        else { cols = newCols || [] }
      }
      setColumns(cols)
      await Promise.all([fetchTasks(), fetchFiles(), fetchProfiles()])
      if (proj?.client_id) await fetchBranding(proj.client_id)
      setLoading(false)
    }
    init()
  }, [projectId])

  useEffect(() => {
    if (activeTab === 'branding' && project?.clients?.drive_folder_id) {
      fetchBrandingFolders(project.clients.drive_folder_id)
    }
  }, [activeTab, project?.clients?.drive_folder_id])

  // ── Computed ──────────────────────────────────────────────────────────────

  const doneTasks = tasks.filter(t => {
    const col = columns.find(c => c.id === t.column_id)
    return col?.name === 'Finalizado' || col?.name === 'Listo' || t.status === 'done'
  }).length
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  // ── Edit project ──────────────────────────────────────────────────────────

  const openEditProject = () => {
    if (!project) return
    setEditForm({ name: project.name, description: project.description || '', status: project.status, start_date: project.start_date || '', due_date: project.due_date || '', github_repo_url: project.github_repo_url || '' })
    setShowEdit(true)
  }
  const saveProject = async () => {
    if (!project) return
    setSaving(true)
    await supabase.from('projects').update({ name: editForm.name.trim(), description: editForm.description.trim() || null, status: editForm.status, start_date: editForm.start_date || null, due_date: editForm.due_date || null, github_repo_url: editForm.github_repo_url.trim() || null }).eq('id', project.id)
    await fetchProject()
    setShowEdit(false); setSaving(false)
  }

  // ── Tasks – Notion panel ──────────────────────────────────────────────────

  const openCreateTask = (colId?: string) => {
    setEditingTask(null)
    setSubtasks([])
    setTaskDetail({ title: '', description: '', priority: 'medium', due_date: '', column_id: colId || columns[0]?.id || '', tags: '', assignees: [], links: [] })
    setShowLinkForm(false); setNewLinkUrl(''); setNewLinkLabel('')
    setAddingSubtask(false); setNewSubtask('')
    setShowTaskDetail(true)
  }

  const openTaskDetail = (t: Task) => {
    setEditingTask(t)
    setTaskDetail({
      title: t.title,
      description: t.description || '',
      priority: t.priority || 'medium',
      due_date: t.due_date || '',
      column_id: t.column_id || '',
      tags: (t.tags || []).join(', '),
      assignees: t.assignees || [],
      links: t.links || [],
    })
    setShowLinkForm(false); setNewLinkUrl(''); setNewLinkLabel('')
    setAddingSubtask(false); setNewSubtask('')
    fetchSubtasks(t.id)
    setShowTaskDetail(true)
  }

  const saveTaskDetail = async () => {
    if (!taskDetail.title.trim()) return
    setSavingDetail(true)
    const { data: userData } = await supabase.auth.getUser()
    const payload: Record<string, unknown> = {
      project_id: projectId,
      title: taskDetail.title.trim(),
      status: 'todo',
      description: taskDetail.description.trim() || null,
      priority: taskDetail.priority,
      due_date: taskDetail.due_date || null,
      column_id: taskDetail.column_id || columns[0]?.id || null,
      tags: taskDetail.tags ? taskDetail.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      assignees: taskDetail.assignees,
      links: taskDetail.links,
      created_by: userData.user?.id,
    }

    if (editingTask) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id)
      if (!error && project) {
        await supabase.from('project_updates').insert({ project_id: projectId, user_id: userData.user?.id, type: 'task_updated', description: `Tarea "${taskDetail.title}" actualizada` }).then(() => {})
      }
    } else {
      const { error } = await supabase.from('tasks').insert(payload)
      if (!error && project) {
        await supabase.from('project_updates').insert({ project_id: projectId, user_id: userData.user?.id, type: 'task_created', description: `Nueva tarea: "${taskDetail.title}"` }).then(() => {})
      }
    }
    setShowTaskDetail(false); setSavingDetail(false); await fetchTasks()
  }

  const deleteTask = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar "${title}"?`)) return
    await supabase.from('tasks').delete().eq('id', id)
    setShowTaskDetail(false)
    await fetchTasks()
  }

  const addSubtask = async () => {
    if (!newSubtask.trim() || !editingTask) return
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('tasks').insert({
      project_id: projectId,
      parent_task_id: editingTask.id,
      title: newSubtask.trim(),
      status: 'todo',
      priority: 'medium',
      created_by: userData.user?.id,
    })
    setNewSubtask('')
    setAddingSubtask(false)
    await fetchSubtasks(editingTask.id)
  }

  const moveTask = async (taskId: string, newColId: string) => {
    await supabase.from('tasks').update({ column_id: newColId }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: newColId } : t))
  }

  const renameColumn = async (colId: string) => {
    if (!colRenameVal.trim()) { setRenamingCol(null); return }
    await supabase.from('kanban_columns').update({ name: colRenameVal.trim() }).eq('id', colId)
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, name: colRenameVal.trim() } : c))
    setRenamingCol(null)
  }

  const addColumn = async () => {
    const name = prompt('Nombre de la nueva columna:')
    if (!name?.trim()) return
    const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.order)) + 1 : 0
    const { data, error } = await supabase.from('kanban_columns').insert({ project_id: projectId, name: name.trim(), color: '#457B9D', order: maxOrder }).select().single()
    if (error) { alert('Error al crear columna. Asegurate de haber ejecutado el SQL de migración en Supabase.'); return }
    if (data) setColumns(prev => [...prev, data])
  }

  const addLink = () => {
    if (!newLinkUrl.trim()) return
    setTaskDetail(prev => ({
      ...prev,
      links: [...prev.links, { url: newLinkUrl.trim(), label: newLinkLabel.trim() || newLinkUrl.trim() }]
    }))
    setNewLinkUrl(''); setNewLinkLabel(''); setShowLinkForm(false)
  }

  const removeLink = (i: number) => {
    setTaskDetail(prev => ({ ...prev, links: prev.links.filter((_, idx) => idx !== i) }))
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  function buildFileName(orig: string) {
    if (!forceNaming || !namingDesc.trim()) return orig
    const ext = getExt(orig)
    const today = new Date()
    const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const client = project?.clients?.name?.replace(/\s+/g, '') || 'Interno'
    return `${d}_${client}_${namingDesc.trim().replace(/\s+/g, '')}${namingStatus}_v${namingVersion}${ext}`
  }

  const handleUpload = async (fileList: FileList) => {
    setUploadError(null)
    const folderId = fileMode === 'fee' ? project?.clients?.drive_fee_folder_id : project?.drive_folder_id
    if (!folderId) { setUploadError(fileMode === 'fee' ? 'El cliente no tiene carpeta de Fee Mensual.' : 'Este proyecto no tiene carpeta en Drive.'); return }
    if (forceNaming && !namingDesc.trim()) { setUploadError('Ingresá un nombre descriptivo para el archivo'); return }
    setUploading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const providerToken = session?.provider_token
    if (!providerToken) { setUploadError('No hay token de Google. Cerrá sesión y volvé a entrar.'); setUploading(false); return }
    let ver = namingVersion
    for (const file of Array.from(fileList)) {
      const finalName = forceNaming ? buildFileName(file.name) : file.name
      const uploadFile = forceNaming ? new window.File([file], finalName, { type: file.type }) : file
      let targetFolderId = folderId
      if (fileMode === 'fee') {
        const now = new Date()
        const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
        const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
        const year = now.getFullYear().toString()
        const monthStr = `${String(now.getMonth() + 1).padStart(2, '0')}_${months[now.getMonth()]}`
        const dayStr = `${String(now.getDate()).padStart(2, '0')}_${days[now.getDay()]}`
        const ensureRes = await fetch('/api/drive/ensure-path', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentFolderId: folderId, pathSegments: [year, `${now.getFullYear()}-${monthStr}`, dayStr], providerToken }),
        })
        const ensureData = await ensureRes.json()
        if (ensureData.folderId) targetFolderId = ensureData.folderId
      }
      const fd = new FormData()
      fd.append('file', uploadFile); fd.append('parentFolderId', targetFolderId); fd.append('providerToken', providerToken)
      const res = await fetch('/api/drive/upload-file', { method: 'POST', body: fd })
      const driveData = await res.json()
      if (!res.ok) { setUploadError(`Error al subir "${file.name}": ${driveData.error}`); continue }
      await supabase.from('files').insert({
        project_id: projectId, name: finalName, file_type: detectFileType(file.type),
        drive_file_id: driveData.fileId, url: driveData.webViewLink,
        size_bytes: driveData.size || file.size, mime_type: file.type,
        visible_to_client: false, version: forceNaming ? ver : 1, storage_path: null,
      })
      const { data: userData } = await supabase.auth.getUser()
      await supabase.from('project_updates').insert({ project_id: projectId, user_id: userData.user?.id, type: 'file_uploaded', description: `Archivo subido: "${finalName}"` }).then(() => {})
      if (forceNaming) ver++
    }
    setUploading(false); setShowUpload(false); setForceNaming(false); setNamingDesc(''); setNamingVersion(1); fetchFiles()
  }

  const toggleVisibility = async (f: FileRecord) => {
    await supabase.from('files').update({ visible_to_client: !f.visible_to_client }).eq('id', f.id); fetchFiles()
  }
  const deleteFile = async (f: FileRecord) => {
    if (!confirm(`¿Eliminar "${f.name}"?`)) return
    if (f.drive_file_id) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.provider_token) await fetch('/api/drive/delete-file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: f.drive_file_id, providerToken: session.provider_token }) })
    }
    if (f.storage_path) await supabase.storage.from('project-files').remove([f.storage_path])
    await supabase.from('files').delete().eq('id', f.id); fetchFiles()
  }

  // ── Branding ──────────────────────────────────────────────────────────────

  const saveColor = async () => {
    if (!project?.client_id || !colorForm.name.trim()) return
    await supabase.from('brand_colors').insert({ client_id: project.client_id, name: colorForm.name.trim(), hex: colorForm.hex })
    setShowColorForm(false); setColorForm({ name: '', hex: '#457B9D' })
    await fetchBranding(project.client_id)
  }
  const saveFont = async () => {
    if (!project?.client_id || !fontForm.name.trim()) return
    await supabase.from('brand_fonts').insert({ client_id: project.client_id, name: fontForm.name.trim(), type: fontForm.type })
    setShowFontForm(false); setFontForm({ name: '', type: 'sans' })
    await fetchBranding(project.client_id)
  }
  const deleteColor = async (id: string) => {
    await supabase.from('brand_colors').delete().eq('id', id)
    if (project?.client_id) await fetchBranding(project.client_id)
  }
  const deleteFont = async (id: string) => {
    await supabase.from('brand_fonts').delete().eq('id', id)
    if (project?.client_id) await fetchBranding(project.client_id)
  }

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) return <div className="flex items-center justify-center h-screen"><p className="text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando proyecto...</p></div>
  if (!project) return <div className="flex flex-col items-center justify-center h-screen gap-4"><p className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Proyecto no encontrado</p><Link href="/dashboard/projects" className="text-xs text-fp-cerulean hover:underline">← Volver a proyectos</Link></div>

  const status = statusConfig[project.status] || statusConfig.draft
  const tabs = [
    { key: 'overview',  label: 'Resumen' },
    { key: 'tasks',     label: `Tareas${tasks.length > 0 ? ` (${tasks.length})` : ''}` },
    { key: 'files',     label: `Archivos${files.length > 0 ? ` (${files.length})` : ''}` },
    { key: 'branding',  label: 'Branding' },
  ] as const

  return (
    <div>
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects" className="p-1.5 rounded-lg text-gray-400 dark:text-fp-text-tertiary hover:text-fp-navy dark:hover:text-fp-honeydew hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"><ArrowLeft size={16} /></Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight truncate">{project.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${status.bg} ${status.text}`}>{status.label}</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {project.clients?.name ? <span className="flex items-center gap-1"><Users size={11} />{project.clients.name}</span> : <span className="italic text-fp-cerulean">Proyecto interno</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {project.github_repo_url && <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean hover:text-fp-cerulean transition-colors"><Github size={13} /> GitHub</a>}
            {project.drive_folder_url && <a href={project.drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean hover:text-fp-cerulean transition-colors"><ExternalLink size={13} /> Drive</a>}
            <button onClick={openEditProject} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean hover:text-fp-cerulean transition-colors"><Pencil size={13} /> Editar</button>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === t.key ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 dark:text-fp-text-tertiary hover:bg-gray-100 dark:hover:bg-fp-hover-dark'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="p-8">

        {/* ── TAB: RESUMEN ── */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-3">Descripción</h3>
                {project.description ? <p className="text-sm text-fp-navy dark:text-fp-honeydew leading-relaxed">{project.description}</p> : <p className="text-sm text-gray-400 dark:text-fp-text-tertiary italic">Sin descripción</p>}
              </div>
              {tasks.length > 0 && (
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider">Progreso</h3>
                    <span className="text-xs text-fp-cerulean font-semibold">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-fp-hover-dark rounded-full overflow-hidden"><div className="h-full bg-fp-cerulean rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
                  <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-2">{doneTasks} de {tasks.length} tareas completadas</p>
                </div>
              )}
              {files.length > 0 && (
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider">Archivos recientes</h3>
                    <button onClick={() => setActiveTab('files')} className="text-xs text-fp-cerulean hover:underline">Ver todos →</button>
                  </div>
                  {files.slice(0, 4).map(f => { const IC = fileTypeIcons[f.file_type] || File; const cc = fileTypeColors[f.file_type] || fileTypeColors.other; return (
                    <div key={f.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark last:border-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cc}`}><IC size={13} /></div>
                      <div className="flex-1 min-w-0"><div className="text-sm text-fp-navy dark:text-fp-honeydew truncate">{f.name}</div><div className="text-xs text-gray-400">{formatSize(f.size_bytes)} · {new Date(f.created_at).toLocaleDateString('es-AR')}</div></div>
                      {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-fp-cerulean"><ExternalLink size={13} /></a>}
                    </div>
                  )})}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider">Detalles</h3>
                {project.budget && <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-fp-cerulean/10 flex items-center justify-center flex-shrink-0"><span className="text-fp-cerulean text-xs font-bold">$</span></div><div><div className="text-xs text-gray-400">Presupuesto</div><div className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">{project.currency} {project.budget.toLocaleString()}</div></div></div>}
                {(project.start_date || project.due_date) && <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-fp-cerulean/10 flex items-center justify-center flex-shrink-0"><Calendar size={13} className="text-fp-cerulean" /></div><div><div className="text-xs text-gray-400">Fechas</div><div className="text-sm text-fp-navy dark:text-fp-honeydew">{project.start_date && new Date(project.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}{project.start_date && project.due_date && ' → '}{project.due_date && new Date(project.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div></div>}
                {project.clients && <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-fp-cerulean/10 flex items-center justify-center flex-shrink-0"><Users size={13} className="text-fp-cerulean" /></div><div><div className="text-xs text-gray-400">Cliente</div><div className="text-sm text-fp-navy dark:text-fp-honeydew">{project.clients.name}</div></div></div>}
                <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-fp-cerulean/10 flex items-center justify-center flex-shrink-0"><FolderOpen size={13} className="text-fp-cerulean" /></div><div><div className="text-xs text-gray-400">Creado</div><div className="text-sm text-fp-navy dark:text-fp-honeydew">{new Date(project.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4 text-center"><div className="text-2xl font-bold text-fp-cerulean">{tasks.length}</div><div className="text-xs text-gray-400 mt-0.5">Tareas</div></div>
                <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4 text-center"><div className="text-2xl font-bold text-fp-cerulean">{files.length}</div><div className="text-xs text-gray-400 mt-0.5">Archivos</div></div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: TAREAS ── */}
        {activeTab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center border border-gray-200 dark:border-fp-border-dark rounded-lg overflow-hidden">
                <button onClick={() => setTaskView('kanban')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${taskView === 'kanban' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark'}`}><LayoutGrid size={13} /> Kanban</button>
                <button onClick={() => setTaskView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${taskView === 'list' ? 'bg-fp-cerulean/10 text-fp-cerulean' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark'}`}><List size={13} /> Lista</button>
              </div>
              <button onClick={() => openCreateTask()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 transition-colors"><Plus size={14} /> Nueva tarea</button>
            </div>

            {/* KANBAN */}
            {taskView === 'kanban' && (
              <div className="flex gap-4 overflow-x-auto pb-4">
                {columns.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-16 text-sm text-gray-400 dark:text-fp-text-tertiary">
                    No hay columnas. Hacé click en "Crear columna" →
                  </div>
                )}
                {columns.map(col => {
                  const colTasks = tasks.filter(t => t.column_id === col.id)
                  return (
                    <div key={col.id} className="flex-shrink-0 w-64 bg-gray-50 dark:bg-fp-card-dark/50 border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (dragging) moveTask(dragging, col.id) }}
                    >
                      <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-200 dark:border-fp-border-dark">
                        {renamingCol === col.id ? (
                          <input autoFocus value={colRenameVal} onChange={e => setColRenameVal(e.target.value)} onBlur={() => renameColumn(col.id)} onKeyDown={e => { if (e.key === 'Enter') renameColumn(col.id); if (e.key === 'Escape') setRenamingCol(null) }} className="flex-1 text-xs font-semibold bg-transparent outline-none border-b border-fp-cerulean text-fp-navy dark:text-fp-honeydew" />
                        ) : (
                          <button onDoubleClick={() => { setRenamingCol(col.id); setColRenameVal(col.name) }} className="flex items-center gap-1.5 text-xs font-semibold text-fp-navy dark:text-fp-honeydew" title="Doble click para renombrar">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.color }} />
                            {col.name}
                          </button>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary bg-gray-100 dark:bg-fp-hover-dark px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                      </div>
                      <div className="p-2 space-y-2 min-h-[100px]">
                        {colTasks.map(task => {
                          const pc = priorityConfig[task.priority] || priorityConfig.medium
                          return (
                            <div key={task.id} draggable onDragStart={() => setDragging(task.id)} onDragEnd={() => setDragging(null)}
                              onClick={() => openTaskDetail(task)}
                              className={`bg-white dark:bg-fp-card-dark border rounded-lg p-3 cursor-pointer hover:border-fp-cerulean/40 transition-colors group ${dragging === task.id ? 'opacity-50' : ''} ${pc.border}`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-xs font-medium text-fp-navy dark:text-fp-honeydew leading-snug flex-1">{task.title}</p>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} title={pc.label} />
                                  {task.due_date && <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Calendar size={9} />{new Date(task.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>}
                                </div>
                                {task.tags && task.tags.length > 0 && <span className="text-[10px] text-fp-cerulean">{task.tags[0]}</span>}
                              </div>
                              {task.description && <p className="text-[10px] text-gray-400 mt-1.5 line-clamp-2">{task.description}</p>}
                            </div>
                          )
                        })}
                      </div>
                      <div className="p-2 border-t border-gray-100 dark:border-fp-border-dark">
                        <button onClick={() => openCreateTask(col.id)} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors">
                          <Plus size={12} /> Agregar tarea
                        </button>
                      </div>
                    </div>
                  )
                })}
                <button onClick={addColumn}
                  className="flex-shrink-0 h-12 mt-0.5 px-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-fp-border-dark flex items-center gap-2 text-xs text-gray-400 hover:text-fp-cerulean hover:border-fp-cerulean/40 transition-colors whitespace-nowrap self-start">
                  <Plus size={14} /> Crear columna
                </button>
              </div>
            )}

            {/* LISTA */}
            {taskView === 'list' && (
              <div className="space-y-4">
                {columns.length === 0 ? (
                  <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-10 text-center">
                    <p className="text-sm text-gray-400 dark:text-fp-text-tertiary mb-3">No hay columnas todavía</p>
                    <button onClick={addColumn} className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-fp-border-dark text-xs text-gray-400 hover:text-fp-cerulean hover:border-fp-cerulean/40 transition-colors mx-auto"><Plus size={14} /> Crear columna</button>
                  </div>
                ) : (
                  <>
                    {columns.map(col => {
                      const colTasks = tasks.filter(t => t.column_id === col.id)
                      return (
                        <div key={col.id} className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-fp-border-dark">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                              <span className="text-xs font-semibold text-fp-navy dark:text-fp-honeydew">{col.name}</span>
                              <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-fp-hover-dark px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                            </div>
                            <button onClick={() => openCreateTask(col.id)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-fp-cerulean transition-colors"><Plus size={11} /> Agregar</button>
                          </div>
                          {colTasks.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-400 dark:text-fp-text-tertiary italic">Sin tareas en esta columna</div>
                          ) : colTasks.map(task => {
                            const pc = priorityConfig[task.priority] || priorityConfig.medium
                            return (
                              <div key={task.id} onClick={() => openTaskDetail(task)} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 dark:border-fp-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors cursor-pointer group">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.dot}`} title={pc.label} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-fp-navy dark:text-fp-honeydew truncate">{task.title}</div>
                                  {task.due_date && <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Calendar size={10} />{new Date(task.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>}
                                </div>
                                {task.tags && task.tags.slice(0, 2).map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-fp-cerulean/10 text-fp-cerulean">{tag}</span>)}
                                <ChevronRight size={13} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                    <button onClick={addColumn} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-fp-border-dark text-xs text-gray-400 hover:text-fp-cerulean hover:border-fp-cerulean/40 transition-colors"><Plus size={14} /> Crear columna</button>
                  </>
                )}
                {tasks.filter(t => !t.column_id).length > 0 && (
                  <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-fp-border-dark">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-fp-navy dark:text-fp-honeydew">Sin columna</span>
                    </div>
                    {tasks.filter(t => !t.column_id).map(task => {
                      const pc = priorityConfig[task.priority] || priorityConfig.medium
                      return (
                        <div key={task.id} onClick={() => openTaskDetail(task)} className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors cursor-pointer group">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.dot}`} />
                          <div className="flex-1 min-w-0"><div className="text-sm text-fp-navy dark:text-fp-honeydew truncate">{task.title}</div></div>
                          <ChevronRight size={13} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ARCHIVOS ── */}
        {activeTab === 'files' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center bg-gray-100 dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-lg p-1 gap-1">
                <button onClick={() => setFileMode('project')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${fileMode === 'project' ? 'bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew shadow-sm' : 'text-gray-400 dark:text-fp-text-tertiary hover:text-fp-navy dark:hover:text-fp-honeydew'}`}>Proyecto Específico</button>
                <button onClick={() => setFileMode('fee')} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${fileMode === 'fee' ? 'bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew shadow-sm' : 'text-gray-400 dark:text-fp-text-tertiary hover:text-fp-navy dark:hover:text-fp-honeydew'}`}>Fee Mensual</button>
              </div>
              <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-sm font-semibold hover:bg-fp-punch-red/20 transition-colors"><Upload size={14} /> Subir archivos</button>
            </div>
            {fileMode === 'fee' && !project.clients?.drive_fee_folder_id && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">⚠ El cliente no tiene carpeta de Fee Mensual en Drive.</div>
            )}
            {showUpload && (
              <div className="mb-5 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Subir archivos</h3>
                    <span className="flex items-center gap-1 text-xs text-fp-cerulean bg-fp-cerulean/10 px-2 py-0.5 rounded-md"><FolderSync size={11} /> Google Drive · {fileMode === 'fee' ? 'Fee Mensual' : 'Proyecto'}</span>
                  </div>
                  <button onClick={() => { setShowUpload(false); setUploadError(null) }} className="text-gray-400 hover:text-fp-punch-red"><X size={16} /></button>
                </div>
                <div className="mb-4 border border-gray-200 dark:border-fp-border-dark rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Tag size={14} className="text-fp-cerulean flex-shrink-0" /><span className="text-sm font-medium text-fp-navy dark:text-fp-honeydew">Nomenclatura Feel Pixel</span></div>
                    <ToggleSwitch on={forceNaming} onToggle={() => setForceNaming(!forceNaming)} />
                  </div>
                  {forceNaming && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className={labelCls}>Nombre</label><input type="text" value={namingDesc} onChange={e => setNamingDesc(e.target.value)} placeholder="Ej: PostNavidad" className={inputCls} /></div>
                        <div><label className={labelCls}>Estado</label>
                          <select value={namingStatus} onChange={e => setNamingStatus(e.target.value)} className={inputCls}>
                            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label} – {s.desc}</option>)}
                          </select>
                        </div>
                        <div><label className={labelCls}>Versión</label><input type="number" min={1} value={namingVersion} onChange={e => setNamingVersion(parseInt(e.target.value) || 1)} className={inputCls + ' font-mono'} /></div>
                      </div>
                      {namingDesc.trim() && <div className="bg-fp-bg-dark/50 dark:bg-fp-bg-dark rounded-lg px-3 py-2"><p className="text-xs text-gray-400 mb-0.5">Preview:</p><p className="text-xs font-mono text-fp-cerulean">{buildFileName('archivo.ext')}</p></div>}
                    </div>
                  )}
                </div>
                {uploadError && <div className="mb-4 px-3 py-2 rounded-lg bg-fp-punch-red/10 border border-fp-punch-red/20 text-xs text-fp-punch-red">{uploadError}</div>}
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-6 cursor-pointer hover:border-fp-cerulean transition-colors">
                  {uploading ? <Loader2 size={28} className="text-fp-cerulean animate-spin mb-2" /> : <Upload size={28} className="text-gray-400 mb-2" />}
                  <p className="text-sm text-fp-navy dark:text-fp-honeydew font-medium">{uploading ? 'Subiendo a Drive...' : 'Hacé click o arrastrá archivos acá'}</p>
                  <p className="text-xs text-gray-400 mt-1">Se guardan en la carpeta Drive de este {fileMode === 'fee' ? 'Fee Mensual' : 'proyecto'}</p>
                  <input type="file" multiple className="hidden" disabled={uploading} onChange={e => e.target.files && handleUpload(e.target.files)} />
                </label>
              </div>
            )}
            {files.length === 0 ? (
              <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
                <FolderOpen size={40} className="text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">No hay archivos todavía</h3>
                <p className="text-xs text-gray-400">Subí el primer archivo con el botón de arriba</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_100px_60px_100px] gap-4 px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark text-xs text-gray-400 uppercase tracking-wider font-medium">
                  <span>Nombre</span><span>Tipo</span><span>Tamaño</span><span>Vis.</span><span className="text-right">Acciones</span>
                </div>
                {files.map(f => { const IC = fileTypeIcons[f.file_type] || File; const cc = fileTypeColors[f.file_type] || fileTypeColors.other; return (
                  <div key={f.id} className="grid grid-cols-[1fr_100px_100px_60px_100px] gap-4 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark last:border-0 items-center hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cc}`}><IC size={13} /></div>
                      <div className="min-w-0"><div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{f.name}</div><div className="text-[10px] text-gray-400">v{f.version} · {new Date(f.created_at).toLocaleDateString('es-AR')}{f.drive_file_id && <span className="ml-1 text-fp-cerulean">· Drive</span>}</div></div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md w-fit ${cc}`}>{f.file_type}</span>
                    <span className="text-xs text-gray-400 font-mono">{formatSize(f.size_bytes)}</span>
                    <button onClick={() => toggleVisibility(f)} className={`p-1 rounded-md transition-colors ${f.visible_to_client ? 'text-fp-cerulean bg-fp-cerulean/10' : 'text-gray-400 hover:text-fp-cerulean'}`}>{f.visible_to_client ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                    <div className="flex items-center gap-1 justify-end">
                      {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors"><ExternalLink size={14} /></a>}
                      <button onClick={() => deleteFile(f)} className="p-1.5 rounded-md text-gray-400 hover:text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: BRANDING ── */}
        {activeTab === 'branding' && (
          <div>
            {!project.client_id ? (
              <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
                <Palette size={40} className="text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">Sin cliente asociado</h3>
                <p className="text-xs text-gray-400">Asociá este proyecto a un cliente para acceder al branding</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 space-y-5">
                  {/* Colors */}
                  <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex items-center justify-between">
                      <div className="flex items-center gap-2"><Palette size={14} className="text-fp-cerulean" /><h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Colores de marca</h3></div>
                      <button onClick={() => setShowColorForm(!showColorForm)} className="flex items-center gap-1 text-xs text-fp-cerulean hover:underline"><Plus size={12} /> Agregar</button>
                    </div>
                    {showColorForm && (
                      <div className="px-5 py-4 border-b border-gray-100 dark:border-fp-border-dark bg-gray-50 dark:bg-fp-hover-dark">
                        <div className="flex items-end gap-3">
                          <div><label className={labelCls}>Nombre</label><input value={colorForm.name} onChange={e => setColorForm({ ...colorForm, name: e.target.value })} placeholder="Ej: Primary Blue" className={inputCls + ' w-40'} /></div>
                          <div><label className={labelCls}>Color</label><div className="flex items-center gap-2"><input type="color" value={colorForm.hex} onChange={e => setColorForm({ ...colorForm, hex: e.target.value })} className="w-10 h-8 rounded cursor-pointer border border-gray-200" /><input value={colorForm.hex} onChange={e => setColorForm({ ...colorForm, hex: e.target.value })} className={inputCls + ' w-28 font-mono'} /></div></div>
                          <button onClick={saveColor} className="px-4 py-2 rounded-lg bg-fp-cerulean text-white text-sm font-semibold hover:bg-fp-cerulean/90">Guardar</button>
                          <button onClick={() => setShowColorForm(false)} className="px-3 py-2 text-gray-400 hover:text-fp-punch-red"><X size={15} /></button>
                        </div>
                      </div>
                    )}
                    <div className="p-5">
                      {brandColors.length === 0 ? <p className="text-sm text-gray-400 italic">Sin colores definidos</p> : (
                        <div className="flex flex-wrap gap-3">
                          {brandColors.map(c => (
                            <div key={c.id} className="flex items-center gap-2 border border-gray-200 dark:border-fp-border-dark rounded-lg p-2.5 group">
                              <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-gray-100" style={{ background: c.hex }} />
                              <div><div className="text-xs font-medium text-fp-navy dark:text-fp-honeydew">{c.name}</div><div className="text-[10px] font-mono text-gray-400">{c.hex.toUpperCase()}</div></div>
                              <button onClick={() => deleteColor(c.id)} className="ml-1 text-gray-200 hover:text-fp-punch-red opacity-0 group-hover:opacity-100 transition-all"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Fonts */}
                  <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex items-center justify-between">
                      <div className="flex items-center gap-2"><Type size={14} className="text-fp-cerulean" /><h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Tipografías</h3></div>
                      <button onClick={() => setShowFontForm(!showFontForm)} className="flex items-center gap-1 text-xs text-fp-cerulean hover:underline"><Plus size={12} /> Agregar</button>
                    </div>
                    {showFontForm && (
                      <div className="px-5 py-4 border-b border-gray-100 dark:border-fp-border-dark bg-gray-50 dark:bg-fp-hover-dark">
                        <div className="flex items-end gap-3">
                          <div><label className={labelCls}>Nombre</label><input value={fontForm.name} onChange={e => setFontForm({ ...fontForm, name: e.target.value })} placeholder="Ej: Neue Haas Grotesk" className={inputCls + ' w-48'} /></div>
                          <div><label className={labelCls}>Tipo</label>
                            <select value={fontForm.type} onChange={e => setFontForm({ ...fontForm, type: e.target.value })} className={inputCls + ' w-32'}>
                              <option value="sans">Sans-serif</option><option value="serif">Serif</option><option value="display">Display</option><option value="mono">Monospace</option>
                            </select>
                          </div>
                          <button onClick={saveFont} className="px-4 py-2 rounded-lg bg-fp-cerulean text-white text-sm font-semibold hover:bg-fp-cerulean/90">Guardar</button>
                          <button onClick={() => setShowFontForm(false)} className="px-3 py-2 text-gray-400 hover:text-fp-punch-red"><X size={15} /></button>
                        </div>
                      </div>
                    )}
                    <div className="p-5">
                      {brandFonts.length === 0 ? <p className="text-sm text-gray-400 italic">Sin tipografías definidas</p> : (
                        <div className="space-y-2">
                          {brandFonts.map(f => (
                            <div key={f.id} className="flex items-center justify-between border border-gray-200 dark:border-fp-border-dark rounded-lg px-4 py-3 group">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-fp-cerulean/10 flex items-center justify-center"><Type size={13} className="text-fp-cerulean" /></div>
                                <div><div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew">{f.name}</div><div className="text-xs text-gray-400 capitalize">{f.type}</div></div>
                              </div>
                              <button onClick={() => deleteFont(f.id)} className="text-gray-200 hover:text-fp-punch-red opacity-0 group-hover:opacity-100 transition-all"><X size={13} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Drive folders */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2"><Layers size={14} className="text-fp-cerulean" /><h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Carpetas Drive</h3></div>
                    <p className="text-xs text-gray-400 mb-4">Material de marca en Google Drive</p>
                    {loadingBrandFolders && <p className="text-xs text-gray-400 italic mb-2">Cargando...</p>}
                    {brandingDriveFolders.map(folder => (
                      folder.url ? (
                        <a key={folder.label} href={folder.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-fp-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-fp-hover-dark rounded-md px-1 -mx-1 transition-colors">
                          <div className="flex items-center gap-2"><FolderOpen size={13} className="text-fp-cerulean flex-shrink-0" /><span className="text-xs text-fp-navy dark:text-fp-honeydew">{folder.label}</span></div>
                          <ExternalLink size={12} className="text-fp-cerulean" />
                        </a>
                      ) : (
                        <div key={folder.label} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-fp-border-dark last:border-0 opacity-50">
                          <div className="flex items-center gap-2"><FolderOpen size={13} className="text-fp-cerulean flex-shrink-0" /><span className="text-xs text-fp-navy dark:text-fp-honeydew">{folder.label}</span></div>
                          <ChevronRight size={12} className="text-gray-300" />
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Project Modal ── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEdit(false)}>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
              <h2 className="text-base font-semibold text-fp-navy dark:text-fp-honeydew">Editar proyecto</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-fp-punch-red"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className={labelCls}>Nombre *</label><input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Descripción</label><textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} className={inputCls + ' resize-none'} /></div>
              <div><label className={labelCls}>Estado</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                  <option value="draft">Borrador</option><option value="active">Activo</option><option value="paused">Pausado</option><option value="completed">Completado</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Inicio</label><input type="date" value={editForm.start_date} onChange={e => setEditForm({ ...editForm, start_date: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Entrega</label><input type="date" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Link repo GitHub</label><input type="url" value={editForm.github_repo_url} onChange={e => setEditForm({ ...editForm, github_repo_url: e.target.value })} placeholder="https://github.com/..." className={inputCls} /></div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-fp-border-dark">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-fp-hover-dark">Cancelar</button>
              <button onClick={saveProject} disabled={!editForm.name.trim() || saving} className="px-5 py-2 rounded-lg bg-fp-cerulean text-white text-sm font-semibold hover:bg-fp-cerulean/90 disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notion-style Task Detail Panel ── */}
      {showTaskDetail && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowTaskDetail(false)}>
          <div className="flex-1" />
          <div
            className="w-[640px] bg-white dark:bg-fp-card-dark border-l border-gray-200 dark:border-fp-border-dark h-full overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark sticky top-0 bg-white dark:bg-fp-card-dark z-10">
              <div className="flex items-center gap-2">
                {editingTask && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-fp-cerulean/10 text-fp-cerulean">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: columns.find(c => c.id === taskDetail.column_id)?.color || '#457B9D' }} />
                    {columns.find(c => c.id === taskDetail.column_id)?.name || 'Sin columna'}
                  </span>
                )}
                {!editingTask && <span className="text-xs text-fp-text-secondary font-medium">Nueva tarea</span>}
              </div>
              <div className="flex items-center gap-2">
                {editingTask && (
                  <button onClick={() => deleteTask(editingTask.id, editingTask.title)} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors">
                    <Trash2 size={12} /> Eliminar
                  </button>
                )}
                <button onClick={() => setShowTaskDetail(false)} className="p-1 text-gray-400 hover:text-fp-punch-red"><X size={16} /></button>
              </div>
            </div>

            {/* Title */}
            <div className="px-6 pt-6 pb-2">
              <textarea
                value={taskDetail.title}
                onChange={e => setTaskDetail({ ...taskDetail, title: e.target.value })}
                placeholder="Título de la tarea..."
                className="w-full text-2xl font-bold text-fp-navy dark:text-fp-honeydew bg-transparent outline-none resize-none leading-tight placeholder:text-gray-300 dark:placeholder:text-fp-text-tertiary"
                rows={2}
              />
            </div>

            {/* Properties */}
            <div className="px-6 py-3 space-y-2.5 border-b border-gray-100 dark:border-fp-border-dark">
              {/* Column */}
              <div className="flex items-center gap-3 min-h-[28px]">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0">Columna</span>
                <select value={taskDetail.column_id} onChange={e => setTaskDetail({ ...taskDetail, column_id: e.target.value })} className="text-sm text-fp-navy dark:text-fp-honeydew bg-transparent outline-none border border-transparent hover:border-fp-border-dark rounded px-2 py-0.5 cursor-pointer">
                  <option value="">— Sin columna —</option>
                  {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Priority */}
              <div className="flex items-center gap-3 min-h-[28px]">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0">Prioridad</span>
                <select value={taskDetail.priority} onChange={e => setTaskDetail({ ...taskDetail, priority: e.target.value })} className="text-sm text-fp-navy dark:text-fp-honeydew bg-transparent outline-none border border-transparent hover:border-fp-border-dark rounded px-2 py-0.5 cursor-pointer">
                  <option value="low">🔵 Baja</option>
                  <option value="medium">🟡 Media</option>
                  <option value="high">🟠 Alta</option>
                  <option value="urgent">🔴 Urgente</option>
                </select>
              </div>
              {/* Due date */}
              <div className="flex items-center gap-3 min-h-[28px]">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0">Fecha límite</span>
                <input type="date" value={taskDetail.due_date} onChange={e => setTaskDetail({ ...taskDetail, due_date: e.target.value })} className="text-sm text-fp-navy dark:text-fp-honeydew bg-transparent outline-none border border-transparent hover:border-fp-border-dark rounded px-2 py-0.5 cursor-pointer" />
              </div>
              {/* Assignees */}
              <div className="flex items-start gap-3 min-h-[28px]">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0 mt-1">Asignados</span>
                <div className="flex flex-wrap gap-1.5">
                  {profiles.map(p => {
                    const selected = taskDetail.assignees.includes(p.id)
                    return (
                      <button key={p.id} onClick={() => setTaskDetail({ ...taskDetail, assignees: selected ? taskDetail.assignees.filter(a => a !== p.id) : [...taskDetail.assignees, p.id] })}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${selected ? 'bg-fp-cerulean text-white' : 'border border-gray-200 dark:border-fp-border-dark text-gray-500 hover:border-fp-cerulean'}`}>
                        <span className="w-3.5 h-3.5 rounded-full bg-fp-cerulean/20 flex items-center justify-center text-[8px] font-bold">{(p.full_name || p.email || '?')[0].toUpperCase()}</span>
                        {p.full_name || p.email}
                      </button>
                    )
                  })}
                  {profiles.length === 0 && <span className="text-xs text-gray-400 italic">Sin miembros en el equipo</span>}
                </div>
              </div>
              {/* Tags */}
              <div className="flex items-center gap-3 min-h-[28px]">
                <span className="text-xs text-gray-400 w-24 flex-shrink-0">Etiquetas</span>
                <input type="text" value={taskDetail.tags} onChange={e => setTaskDetail({ ...taskDetail, tags: e.target.value })} placeholder="diseño, urgente (separadas por coma)..." className="flex-1 text-sm text-fp-navy dark:text-fp-honeydew bg-transparent outline-none border border-transparent hover:border-fp-border-dark focus:border-fp-cerulean rounded px-2 py-0.5" />
              </div>
            </div>

            {/* Description */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Descripción</p>
              <textarea
                value={taskDetail.description}
                onChange={e => setTaskDetail({ ...taskDetail, description: e.target.value })}
                placeholder="Agregá una descripción detallada..."
                className="w-full text-sm text-fp-navy dark:text-fp-honeydew bg-transparent outline-none resize-none leading-relaxed min-h-[80px] placeholder:text-gray-300 dark:placeholder:text-fp-text-tertiary"
                rows={4}
              />
            </div>

            {/* Links */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Links</p>
                <button onClick={() => setShowLinkForm(!showLinkForm)} className="flex items-center gap-1 text-xs text-fp-cerulean hover:underline"><Plus size={12} /> Agregar</button>
              </div>
              {showLinkForm && (
                <div className="mb-3 flex gap-2">
                  <input type="text" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)} placeholder="Etiqueta" className={inputCls + ' flex-1'} />
                  <input type="url" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://..." className={inputCls + ' flex-1'} onKeyDown={e => { if (e.key === 'Enter') addLink() }} />
                  <button onClick={addLink} className="px-3 py-2 rounded-lg bg-fp-cerulean text-white text-xs font-semibold">OK</button>
                </div>
              )}
              <div className="space-y-1.5">
                {taskDetail.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <Link2 size={12} className="text-fp-cerulean flex-shrink-0" />
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-fp-cerulean hover:underline flex-1 truncate">{link.label || link.url}</a>
                    <button onClick={() => removeLink(i)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-fp-punch-red transition-all"><X size={12} /></button>
                  </div>
                ))}
                {taskDetail.links.length === 0 && !showLinkForm && <p className="text-xs text-gray-400 italic">Sin links</p>}
              </div>
            </div>

            {/* Subtasks – solo si estamos editando una tarea existente */}
            {editingTask && (
              <div className="px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Subtareas {subtasks.length > 0 && `(${subtasks.length})`}</p>
                  <button onClick={() => setAddingSubtask(!addingSubtask)} className="flex items-center gap-1 text-xs text-fp-cerulean hover:underline"><Plus size={12} /> Agregar</button>
                </div>
                {addingSubtask && (
                  <div className="mb-3 flex gap-2">
                    <input type="text" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSubtask() }} placeholder="Título de la subtarea..." className={inputCls} autoFocus />
                    <button onClick={addSubtask} className="px-3 py-2 rounded-lg bg-fp-cerulean text-white text-xs font-semibold whitespace-nowrap">Crear</button>
                  </div>
                )}
                {loadingSubtasks ? (
                  <p className="text-xs text-gray-400 italic">Cargando...</p>
                ) : (
                  <div className="space-y-1">
                    {subtasks.map(st => {
                      const pc = priorityConfig[st.priority] || priorityConfig.medium
                      return (
                        <div key={st.id} className="flex items-center gap-2 group py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-fp-hover-dark">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.dot}`} />
                          <span className="text-sm text-fp-navy dark:text-fp-honeydew flex-1 truncate">{st.title}</span>
                          <button onClick={() => { supabase.from('tasks').delete().eq('id', st.id).then(() => fetchSubtasks(editingTask.id)) }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-fp-punch-red transition-all"><X size={12} /></button>
                        </div>
                      )
                    })}
                    {subtasks.length === 0 && !addingSubtask && <p className="text-xs text-gray-400 italic">Sin subtareas</p>}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-fp-card-dark border-t border-gray-100 dark:border-fp-border-dark px-6 py-4 flex justify-between items-center mt-auto">
              {editingTask ? (
                <span className="text-xs text-gray-400">Creada {new Date(editingTask.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={() => setShowTaskDetail(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-fp-hover-dark">Cancelar</button>
                <button onClick={saveTaskDetail} disabled={!taskDetail.title.trim() || savingDetail} className="px-5 py-2 rounded-lg bg-fp-cerulean text-white text-sm font-semibold hover:bg-fp-cerulean/90 disabled:opacity-50">
                  {savingDetail ? 'Guardando...' : editingTask ? 'Guardar cambios' : 'Crear tarea'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
