'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Clock,
  FolderOpen,
  CheckCircle,
  RefreshCw,
  CalendarDays,
  Users,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Source = 'task' | 'project' | 'service' | 'event'
type ViewMode = 'year' | 'month' | 'week' | 'agenda'

interface CalItem {
  id: string
  source: Source
  dateKey: string // 'YYYY-MM-DD' (fecha local)
  time: string | null
  title: string
  subtitle: string
  urgent: boolean
  raw: any
}

// ─── Helpers de fechas ───────────────────────────────────────────────────────

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = copy.getDay()
  const diff = day === 0 ? 6 : day - 1
  copy.setDate(copy.getDate() - diff)
  return copy
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DAY_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const DAY_NAMES_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// ─── Configuración visual por fuente ─────────────────────────────────────────

const SOURCE_CONFIG: Record<Source, { label: string; dot: string; pill: string }> = {
  task: {
    label: 'Tareas',
    dot: 'bg-fp-cerulean',
    pill: 'bg-fp-cerulean/15 text-fp-cerulean',
  },
  project: {
    label: 'Proyectos',
    dot: 'bg-fp-frosted',
    pill: 'bg-fp-frosted/20 text-fp-navy dark:text-fp-frosted',
  },
  service: {
    label: 'Servicios',
    dot: 'bg-amber-500',
    pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  event: {
    label: 'Eventos',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
}

const URGENT_PILL = 'bg-fp-punch-red/15 text-fp-punch-red'
const URGENT_DOT = 'bg-fp-punch-red'

const CATEGORY_LABELS: Record<string, string> = {
  meeting: 'Reunión',
  delivery: 'Entrega',
  reminder: 'Recordatorio',
  other: 'Otro',
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
  other: 'Otro',
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Por hacer',
  in_progress: 'En progreso',
  review: 'En revisión',
  done: 'Terminada',
}

function pillClass(item: CalItem): string {
  if (item.source === 'task' && item.urgent) return URGENT_PILL
  return SOURCE_CONFIG[item.source].pill
}

function dotClass(item: CalItem): string {
  if (item.source === 'task' && item.urgent) return URGENT_DOT
  return SOURCE_CONFIG[item.source].dot
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const supabase = createClient()

  // ── Data ──
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CalItem[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})
  const [profilesList, setProfilesList] = useState<{ id: string; name: string }[]>([])
  const [clientsList, setClientsList] = useState<{ id: string; name: string }[]>([])
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)

  // ── Vista ──
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [filters, setFilters] = useState<Record<Source, boolean>>({
    task: true,
    project: true,
    service: true,
    event: true,
  })

  // ── Modales de detalle / día ──
  const [selected, setSelected] = useState<CalItem | null>(null)
  const [dayModal, setDayModal] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // ── Modal crear / editar ──
  const [createModal, setCreateModal] = useState<{ tab: 'event' | 'task'; dateKey: string } | null>(null)
  const [editingEvent, setEditingEvent] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Formulario evento ──
  const [evTitle, setEvTitle] = useState('')
  const [evDescription, setEvDescription] = useState('')
  const [evDate, setEvDate] = useState('')
  const [evStartTime, setEvStartTime] = useState('09:00')
  const [evEndTime, setEvEndTime] = useState('10:00')
  const [evAllDay, setEvAllDay] = useState(false)
  const [evCategory, setEvCategory] = useState('other')
  const [evClientId, setEvClientId] = useState('')
  const [evLink, setEvLink] = useState('')
  const [evAttendees, setEvAttendees] = useState<string[]>([])

  // ── Formulario tarea ──
  const [tkTitle, setTkTitle] = useState('')
  const [tkProjectId, setTkProjectId] = useState('')
  const [tkStatus, setTkStatus] = useState('todo')
  const [tkPriority, setTkPriority] = useState('medium')
  const [tkDueDate, setTkDueDate] = useState('')

  const todayKey = keyOf(new Date())

  // ── Carga de datos ──
  async function loadData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const [tasksRes, projectsRes, servicesRes, eventsRes, profilesRes, clientsRes, allProjectsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, due_date, priority, status, project_id, projects(name)')
        .not('due_date', 'is', null)
        .neq('status', 'done'),
      supabase
        .from('projects')
        .select('id, name, start_date, due_date, status, clients(name)')
        .neq('status', 'completed'),
      supabase
        .from('services')
        .select('id, name, next_renewal, cost, currency, billing_cycle, status')
        .eq('status', 'active')
        .not('next_renewal', 'is', null),
      supabase
        .from('calendar_events')
        .select('*, clients(name)'),
      supabase
        .from('profiles')
        .select('id, full_name, role'),
      supabase
        .from('clients')
        .select('id, name')
        .order('name'),
      supabase
        .from('projects')
        .select('id, name')
        .neq('status', 'completed')
        .order('name'),
    ])

    const built: CalItem[] = []

    for (const t of tasksRes.data || []) {
      const task: any = t
      built.push({
        id: `task-${task.id}`,
        source: 'task',
        dateKey: keyOf(parseDateOnly(task.due_date)),
        time: null,
        title: task.title,
        subtitle: task.projects?.name || 'Sin proyecto',
        urgent: task.priority === 'urgent' || task.priority === 'high',
        raw: task,
      })
    }

    for (const p of projectsRes.data || []) {
      const project: any = p
      if (project.start_date) {
        built.push({
          id: `project-start-${project.id}`,
          source: 'project',
          dateKey: keyOf(parseDateOnly(project.start_date)),
          time: null,
          title: project.name,
          subtitle: `Inicio · ${project.clients?.name || 'Interno'}`,
          urgent: false,
          raw: project,
        })
      }
      if (project.due_date) {
        built.push({
          id: `project-due-${project.id}`,
          source: 'project',
          dateKey: keyOf(parseDateOnly(project.due_date)),
          time: null,
          title: project.name,
          subtitle: `Entrega · ${project.clients?.name || 'Interno'}`,
          urgent: false,
          raw: project,
        })
      }
    }

    for (const s of servicesRes.data || []) {
      const service: any = s
      built.push({
        id: `service-${service.id}`,
        source: 'service',
        dateKey: keyOf(parseDateOnly(service.next_renewal)),
        time: null,
        title: service.name,
        subtitle: `Renovación · ${service.currency === 'USD' ? 'US$' : '$'}${Number(service.cost).toLocaleString('es-AR')}`,
        urgent: false,
        raw: service,
      })
    }

    for (const e of eventsRes.data || []) {
      const event: any = e
      const start = new Date(event.starts_at)
      built.push({
        id: `event-${event.id}`,
        source: 'event',
        dateKey: keyOf(start),
        time: event.all_day
          ? null
          : start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        title: event.title,
        subtitle: CATEGORY_LABELS[event.category] || 'Evento',
        urgent: false,
        raw: event,
      })
    }

    const profileMap: Record<string, string> = {}
    const profList: { id: string; name: string }[] = []
    for (const pr of profilesRes.data || []) {
      const profile: any = pr
      profileMap[profile.id] = profile.full_name || 'Usuario'
      profList.push({ id: profile.id, name: profile.full_name || 'Usuario' })
      if (user && profile.id === user.id && profile.role === 'admin') {
        setIsAdmin(true)
      }
    }

    setItems(built)
    setProfiles(profileMap)
    setProfilesList(profList)
    setClientsList(clientsRes.data?.map((c: any) => ({ id: c.id, name: c.name })) || [])
    setProjectsList(allProjectsRes.data?.map((p: any) => ({ id: p.id, name: p.name })) || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Filtrado e índice por día ──
  const visibleItems = useMemo(
    () => items.filter(i => filters[i.source]),
    [items, filters]
  )

  const itemsByDay = useMemo(() => {
    const map: Record<string, CalItem[]> = {}
    for (const item of visibleItems) {
      if (!map[item.dateKey]) map[item.dateKey] = []
      map[item.dateKey].push(item)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        if (a.time && !b.time) return -1
        if (!a.time && b.time) return 1
        if (a.time && b.time) return a.time.localeCompare(b.time)
        return a.title.localeCompare(b.title)
      })
    }
    return map
  }, [visibleItems])

  // ── Navegación ──
  function goToday() { setCursor(new Date()) }

  function navigate(direction: 1 | -1) {
    const next = new Date(cursor)
    if (view === 'year') next.setFullYear(next.getFullYear() + direction)
    else if (view === 'month') next.setMonth(next.getMonth() + direction)
    else if (view === 'week') next.setDate(next.getDate() + 7 * direction)
    else next.setDate(next.getDate() + 30 * direction)
    setCursor(next)
  }

  function rangeLabel(): string {
    if (view === 'year') return String(cursor.getFullYear())
    if (view === 'month') return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`
    if (view === 'week') {
      const start = startOfWeek(cursor)
      const end = addDays(start, 6)
      const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`
    }
    return 'Próximos 30 días'
  }

  // ── Celdas del mes ──
  function monthCells(year: number, month: number): (number | null)[] {
    const firstDay = new Date(year, month, 1).getDay()
    const startOffset = firstDay === 0 ? 6 : firstDay - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  // ── Helpers del modal de crear / editar ──
  function resetEventForm(dateKey?: string) {
    setEvTitle('')
    setEvDescription('')
    setEvDate(dateKey || todayKey)
    setEvStartTime('09:00')
    setEvEndTime('10:00')
    setEvAllDay(false)
    setEvCategory('other')
    setEvClientId('')
    setEvLink('')
    setEvAttendees([])
  }

  function resetTaskForm(dateKey?: string) {
    setTkTitle('')
    setTkProjectId('')
    setTkStatus('todo')
    setTkPriority('medium')
    setTkDueDate(dateKey || todayKey)
  }

  function openCreate(dateKey: string, tab: 'event' | 'task' = 'event') {
    setEditingEvent(null)
    setDeleteConfirm(false)
    resetEventForm(dateKey)
    resetTaskForm(dateKey)
    setCreateModal({ tab, dateKey })
    setSelected(null)
    setDayModal(null)
  }

  function openEdit(raw: any) {
    const start = new Date(raw.starts_at)
    const end = raw.ends_at ? new Date(raw.ends_at) : null
    setEvTitle(raw.title || '')
    setEvDescription(raw.description || '')
    setEvDate(keyOf(start))
    setEvStartTime(raw.all_day ? '09:00' : start.toTimeString().slice(0, 5))
    setEvEndTime(end && !raw.all_day ? end.toTimeString().slice(0, 5) : '10:00')
    setEvAllDay(raw.all_day || false)
    setEvCategory(raw.category || 'other')
    setEvClientId(raw.client_id || '')
    setEvLink(raw.link || '')
    setEvAttendees(Array.isArray(raw.attendees) ? raw.attendees : [])
    setEditingEvent(raw)
    setDeleteConfirm(false)
    setCreateModal({ tab: 'event', dateKey: keyOf(start) })
    setSelected(null)
  }

  async function handleSaveEvent() {
    if (!evTitle.trim() || !evDate) return
    setSaving(true)
    try {
      const startsAt = evAllDay ? `${evDate}T00:00:00` : `${evDate}T${evStartTime}:00`
      const endsAt = evAllDay ? `${evDate}T23:59:59` : `${evDate}T${evEndTime}:00`

      if (editingEvent) {
        await supabase.from('calendar_events').update({
          title: evTitle.trim(),
          description: evDescription.trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          all_day: evAllDay,
          category: evCategory,
          client_id: evClientId || null,
          link: evLink.trim() || null,
          attendees: evAttendees,
        }).eq('id', editingEvent.id)
      } else {
        const { data: newEvent } = await supabase.from('calendar_events').insert({
          title: evTitle.trim(),
          description: evDescription.trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          all_day: evAllDay,
          category: evCategory,
          client_id: evClientId || null,
          link: evLink.trim() || null,
          attendees: evAttendees,
          created_by: currentUserId,
        }).select().single()

        // Notificar a invitados
        if (newEvent && evAttendees.length > 0) {
          const dateFormatted = parseDateOnly(evDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
          const notifs = evAttendees
            .filter(id => id !== currentUserId)
            .map(id => ({
              recipient_id: id,
              title: `Nuevo evento: ${evTitle.trim()}`,
              message: `Fuiste invitado/a a "${evTitle.trim()}" el ${dateFormatted}`,
              link: '/dashboard/calendar',
            }))
          if (notifs.length > 0) {
            await supabase.from('notifications').insert(notifs)
          }
        }
      }

      setCreateModal(null)
      await loadData()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveTask() {
    if (!tkTitle.trim() || !tkProjectId) return
    setSaving(true)
    try {
      await supabase.from('tasks').insert({
        title: tkTitle.trim(),
        project_id: tkProjectId,
        status: tkStatus,
        priority: tkPriority,
        due_date: tkDueDate || null,
      })
      setCreateModal(null)
      await loadData()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEvent(eventId: string) {
    setSaving(true)
    try {
      await supabase.from('calendar_events').delete().eq('id', eventId)
      setSelected(null)
      setCreateModal(null)
      setDeleteConfirm(false)
      await loadData()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function canEditEvent(raw: any): boolean {
    return isAdmin || raw.created_by === currentUserId
  }

  // ── Chip de evento ──
  function ItemPill({ item, compact }: { item: CalItem; compact?: boolean }) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setSelected(item) }}
        className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate transition-opacity hover:opacity-75 ${pillClass(item)} ${compact ? '' : 'mb-0.5'}`}
        title={item.title}
      >
        {item.time && <span className="opacity-70 mr-1">{item.time}</span>}
        {item.title}
      </button>
    )
  }

  // ── Vista MES ──
  function MonthView() {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const cells = monthCells(year, month)

    return (
      <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-fp-border-dark">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-400 dark:text-fp-text-tertiary uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) {
              return <div key={i} className="min-h-[92px] border-b border-r border-gray-50 dark:border-fp-border-dark bg-gray-50/50 dark:bg-fp-bg-dark/40" />
            }
            const key = keyOf(new Date(year, month, day))
            const dayItems = itemsByDay[key] || []
            const isToday = key === todayKey
            const extra = dayItems.length - 3

            return (
              <div
                key={i}
                className={`min-h-[92px] border-b border-r border-gray-50 dark:border-fp-border-dark p-1 transition-colors cursor-pointer hover:bg-fp-cerulean/3 ${isToday ? 'bg-fp-cerulean/5' : ''}`}
                onClick={() => openCreate(key)}
              >
                <div className="flex justify-end mb-0.5">
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-medium ${
                    isToday ? 'bg-fp-cerulean text-white' : 'text-fp-navy dark:text-fp-honeydew'
                  }`}>
                    {day}
                  </span>
                </div>
                {dayItems.slice(0, 3).map(item => (
                  <ItemPill key={item.id} item={item} />
                ))}
                {extra > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDayModal(key) }}
                    className="w-full text-left px-1.5 text-[10px] text-gray-400 dark:text-fp-text-tertiary hover:text-fp-cerulean transition-colors"
                  >
                    +{extra} más
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Vista SEMANA ──
  function WeekView() {
    const start = startOfWeek(cursor)
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

    return (
      <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 divide-x divide-gray-50 dark:divide-fp-border-dark">
          {days.map((d, i) => {
            const key = keyOf(d)
            const dayItems = itemsByDay[key] || []
            const isToday = key === todayKey
            return (
              <div key={i} className="min-h-[260px] flex flex-col">
                <div className={`px-2 py-2 border-b border-gray-100 dark:border-fp-border-dark text-center ${isToday ? 'bg-fp-cerulean/5' : ''}`}>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-fp-text-tertiary">{DAY_NAMES[i]}</div>
                  <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-fp-cerulean' : 'text-fp-navy dark:text-fp-honeydew'}`}>
                    {d.getDate()}
                  </div>
                </div>
                <div
                  className="flex-1 p-1 space-y-1 cursor-pointer hover:bg-fp-cerulean/3 transition-colors"
                  onClick={() => openCreate(key)}
                >
                  {dayItems.map(item => (
                    <button
                      key={item.id}
                      onClick={(e) => { e.stopPropagation(); setSelected(item) }}
                      className={`w-full text-left px-1.5 py-1 rounded text-[10px] font-medium transition-opacity hover:opacity-75 ${pillClass(item)}`}
                    >
                      {item.time && <div className="opacity-70 text-[9px]">{item.time}</div>}
                      <div className="truncate">{item.title}</div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Vista AÑO ──
  function YearView() {
    const year = cursor.getFullYear()

    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MONTH_NAMES.map((name, month) => {
          const cells = monthCells(year, month)
          return (
            <button
              key={month}
              onClick={() => {
                setCursor(new Date(year, month, 1))
                setView('month')
              }}
              className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-3 text-left hover:border-fp-cerulean/50 transition-colors"
            >
              <div className="text-xs font-semibold text-fp-navy dark:text-fp-honeydew mb-2">{name}</div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {DAY_NAMES.map(d => (
                  <div key={d} className="text-center text-[8px] text-gray-300 dark:text-fp-text-tertiary">{d[0]}</div>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const key = keyOf(new Date(year, month, day))
                  const dayItems = itemsByDay[key] || []
                  const isToday = key === todayKey
                  const dots = dayItems.slice(0, 3)
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[9px] ${
                        isToday ? 'bg-fp-cerulean text-white font-semibold' : 'text-fp-navy dark:text-fp-honeydew'
                      }`}>
                        {day}
                      </span>
                      <div className="flex gap-px h-1 mt-px">
                        {dots.map(item => (
                          <span key={item.id} className={`w-1 h-1 rounded-full ${dotClass(item)}`} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // ── Vista AGENDA ──
  function AgendaView() {
    const start = new Date()
    const days = Array.from({ length: 30 }, (_, i) => addDays(start, i))
    const daysWithItems = days.filter(d => (itemsByDay[keyOf(d)] || []).length > 0)

    if (daysWithItems.length === 0) {
      return (
        <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-10 text-center">
          <CheckCircle size={28} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-fp-text-tertiary">Sin fechas en los próximos 30 días</p>
        </div>
      )
    }

    return (
      <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
        {daysWithItems.map(d => {
          const key = keyOf(d)
          const dayItems = itemsByDay[key] || []
          const isToday = key === todayKey
          return (
            <div key={key} className="flex gap-4 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark last:border-0">
              <div className="w-16 flex-shrink-0 text-right">
                <div className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-fp-cerulean font-semibold' : 'text-gray-400 dark:text-fp-text-tertiary'}`}>
                  {isToday ? 'Hoy' : DAY_NAMES_FULL[(d.getDay() + 6) % 7].slice(0, 3)}
                </div>
                <div className={`text-lg font-bold leading-tight ${isToday ? 'text-fp-cerulean' : 'text-fp-navy dark:text-fp-honeydew'}`}>
                  {d.getDate()}
                </div>
                <div className="text-[9px] text-gray-400 dark:text-fp-text-tertiary">
                  {MONTH_NAMES[d.getMonth()].slice(0, 3)}
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {dayItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass(item)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{item.title}</div>
                      <div className="text-xs text-gray-400 dark:text-fp-text-tertiary truncate">{item.subtitle}</div>
                    </div>
                    {item.time && (
                      <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary flex-shrink-0 flex items-center gap-1">
                        <Clock size={10} /> {item.time}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Modal de detalle ──
  function DetailModal() {
    if (!selected) return null
    const item = selected
    const raw = item.raw
    const cfg = SOURCE_CONFIG[item.source]
    const dateLabel = parseDateOnly(item.dateKey).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const canEdit = item.source === 'event' && canEditEvent(raw)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setSelected(null); setDeleteConfirm(false) }}>
        <div
          className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl w-full max-w-md p-5"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2 ${pillClass(item)}`}>
                {item.source === 'task' && item.urgent ? `${cfg.label} · ${PRIORITY_LABELS[raw.priority] || ''}` : cfg.label}
              </span>
              <h3 className="text-base font-semibold text-fp-navy dark:text-fp-honeydew break-words">{item.title}</h3>
            </div>
            <button onClick={() => { setSelected(null); setDeleteConfirm(false) }} className="text-gray-400 hover:text-fp-punch-red transition-colors flex-shrink-0">
              <X size={18} />
            </button>
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-500 dark:text-fp-text-secondary capitalize">
              <CalendarDays size={14} className="flex-shrink-0" />
              {dateLabel}{item.time ? ` · ${item.time} hs` : ''}
            </div>

            {item.source === 'task' && (
              <>
                <div className="flex items-center gap-2 text-gray-500 dark:text-fp-text-secondary">
                  <FolderOpen size={14} className="flex-shrink-0" />
                  {raw.projects?.name || 'Sin proyecto'}
                </div>
                {raw.project_id && (
                  <Link href={`/dashboard/projects/${raw.project_id}`} className="inline-flex items-center gap-1.5 text-fp-cerulean hover:underline text-xs font-semibold mt-1">
                    Ver proyecto <ExternalLink size={12} />
                  </Link>
                )}
              </>
            )}

            {item.source === 'project' && (
              <>
                <div className="flex items-center gap-2 text-gray-500 dark:text-fp-text-secondary">
                  <Users size={14} className="flex-shrink-0" />
                  {raw.clients?.name || 'Proyecto interno'}
                </div>
                <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">{item.subtitle}</div>
                <Link href={`/dashboard/projects/${raw.id}`} className="inline-flex items-center gap-1.5 text-fp-cerulean hover:underline text-xs font-semibold mt-1">
                  Ver proyecto <ExternalLink size={12} />
                </Link>
              </>
            )}

            {item.source === 'service' && (
              <>
                <div className="flex items-center gap-2 text-gray-500 dark:text-fp-text-secondary">
                  <RefreshCw size={14} className="flex-shrink-0" />
                  {item.subtitle} · {CYCLE_LABELS[raw.billing_cycle] || raw.billing_cycle}
                </div>
                <Link href="/dashboard/services" className="inline-flex items-center gap-1.5 text-fp-cerulean hover:underline text-xs font-semibold mt-1">
                  Ver servicios <ExternalLink size={12} />
                </Link>
              </>
            )}

            {item.source === 'event' && (
              <>
                {raw.description && (
                  <p className="text-gray-500 dark:text-fp-text-secondary whitespace-pre-wrap">{raw.description}</p>
                )}
                {raw.clients?.name && (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-fp-text-secondary">
                    <Users size={14} className="flex-shrink-0" />
                    {raw.clients.name}
                  </div>
                )}
                {Array.isArray(raw.attendees) && raw.attendees.length > 0 && (
                  <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">
                    Invitados: {raw.attendees.map((id: string) => profiles[id] || '—').join(', ')}
                  </div>
                )}
                {raw.link && (
                  <a
                    href={raw.link.startsWith('http') ? raw.link : `https://${raw.link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-fp-cerulean hover:underline text-xs font-semibold mt-1"
                  >
                    Abrir link <ExternalLink size={12} />
                  </a>
                )}

                {/* Acciones editar / eliminar */}
                {canEdit && (
                  <div className="pt-2 border-t border-gray-100 dark:border-fp-border-dark mt-2">
                    {deleteConfirm ? (
                      <div className="space-y-2">
                        <p className="text-xs text-fp-punch-red font-medium">¿Eliminar este evento?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteEvent(raw.id)}
                            disabled={saving}
                            className="flex-1 px-3 py-1.5 bg-fp-punch-red text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {saving ? 'Eliminando…' : 'Sí, eliminar'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(false)}
                            className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-fp-border-dark rounded-lg text-xs font-semibold text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(raw)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-fp-border-dark rounded-lg text-xs font-semibold text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/50 hover:text-fp-cerulean transition-colors"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-fp-border-dark rounded-lg text-xs font-semibold text-gray-500 dark:text-fp-text-secondary hover:border-fp-punch-red/50 hover:text-fp-punch-red transition-colors"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Modal "ver todos los del día" ──
  function DayModal() {
    if (!dayModal) return null
    const dayItems = itemsByDay[dayModal] || []
    const dateLabel = parseDateOnly(dayModal).toLocaleDateString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDayModal(null)}>
        <div
          className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl w-full max-w-sm p-5"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew capitalize">{dateLabel}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCreate(dayModal)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-fp-cerulean text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus size={12} /> Nuevo
              </button>
              <button onClick={() => setDayModal(null)} className="text-gray-400 hover:text-fp-punch-red transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {dayItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setDayModal(null); setSelected(item) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors text-left"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass(item)}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{item.title}</div>
                  <div className="text-xs text-gray-400 dark:text-fp-text-tertiary truncate">{item.subtitle}</div>
                </div>
                {item.time && (
                  <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary flex-shrink-0">{item.time}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Modal crear / editar ──
  function CreateEditModal() {
    if (!createModal) return null
    const isEditing = !!editingEvent
    const activeTab = createModal.tab

    const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew text-sm focus:outline-none focus:border-fp-cerulean/60 transition-colors'
    const labelClass = 'block text-xs font-semibold text-gray-500 dark:text-fp-text-secondary mb-1'

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setCreateModal(null)}
      >
        <div
          className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-fp-border-dark flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                {isEditing ? 'Editar evento' : activeTab === 'event' ? 'Nuevo evento' : 'Nueva tarea'}
              </h2>
              {/* Tabs (solo al crear) */}
              {!isEditing && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-fp-bg-dark rounded-lg p-0.5">
                  {(['event', 'task'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setCreateModal({ ...createModal, tab })}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                        activeTab === tab
                          ? 'bg-white dark:bg-fp-card-dark text-fp-cerulean shadow-sm'
                          : 'text-gray-400 dark:text-fp-text-secondary hover:text-fp-navy dark:hover:text-fp-honeydew'
                      }`}
                    >
                      {tab === 'event' ? 'Evento' : 'Tarea'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setCreateModal(null)} className="text-gray-400 hover:text-fp-punch-red transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

            {/* ── FORMULARIO EVENTO ── */}
            {activeTab === 'event' && (
              <>
                {/* Título */}
                <div>
                  <label className={labelClass}>Título *</label>
                  <input
                    type="text"
                    value={evTitle}
                    onChange={e => setEvTitle(e.target.value)}
                    placeholder="Nombre del evento"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                {/* Fecha + horas */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className={labelClass}>Fecha *</label>
                    <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} className={inputClass} />
                  </div>
                  {!evAllDay && (
                    <>
                      <div>
                        <label className={labelClass}>Inicio</label>
                        <input type="time" value={evStartTime} onChange={e => setEvStartTime(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Fin</label>
                        <input type="time" value={evEndTime} onChange={e => setEvEndTime(e.target.value)} className={inputClass} />
                      </div>
                    </>
                  )}
                </div>

                {/* Toggle todo el día */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setEvAllDay(!evAllDay)}
                    className={`w-8 h-4 rounded-full transition-colors relative ${evAllDay ? 'bg-fp-cerulean' : 'bg-gray-200 dark:bg-fp-border-dark'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${evAllDay ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-fp-text-secondary">Todo el día</span>
                </label>

                {/* Categoría */}
                <div>
                  <label className={labelClass}>Categoría</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setEvCategory(val)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          evCategory === val
                            ? 'bg-fp-cerulean border-fp-cerulean text-white'
                            : 'border-gray-200 dark:border-fp-border-dark text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className={labelClass}>Descripción</label>
                  <textarea
                    value={evDescription}
                    onChange={e => setEvDescription(e.target.value)}
                    placeholder="Detalles del evento…"
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* Cliente */}
                <div>
                  <label className={labelClass}>Cliente (opcional)</label>
                  <select value={evClientId} onChange={e => setEvClientId(e.target.value)} className={inputClass}>
                    <option value="">Sin cliente</option>
                    {clientsList.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Invitados */}
                <div>
                  <label className={labelClass}>Invitados</label>
                  <div className="flex flex-wrap gap-1.5">
                    {profilesList
                      .filter(p => p.id !== currentUserId)
                      .map(p => {
                        const active = evAttendees.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            onClick={() => setEvAttendees(prev =>
                              active ? prev.filter(id => id !== p.id) : [...prev, p.id]
                            )}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? 'bg-fp-cerulean border-fp-cerulean text-white'
                                : 'border-gray-200 dark:border-fp-border-dark text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/50'
                            }`}
                          >
                            {p.name}
                          </button>
                        )
                      })}
                    {profilesList.filter(p => p.id !== currentUserId).length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-fp-text-tertiary">No hay otros usuarios en el equipo</p>
                    )}
                  </div>
                </div>

                {/* Link */}
                <div>
                  <label className={labelClass}>Link (opcional)</label>
                  <input
                    type="text"
                    value={evLink}
                    onChange={e => setEvLink(e.target.value)}
                    placeholder="https://meet.google.com/…"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {/* ── FORMULARIO TAREA ── */}
            {activeTab === 'task' && (
              <>
                {/* Título */}
                <div>
                  <label className={labelClass}>Título *</label>
                  <input
                    type="text"
                    value={tkTitle}
                    onChange={e => setTkTitle(e.target.value)}
                    placeholder="Nombre de la tarea"
                    className={inputClass}
                    autoFocus
                  />
                </div>

                {/* Proyecto */}
                <div>
                  <label className={labelClass}>Proyecto *</label>
                  <select value={tkProjectId} onChange={e => setTkProjectId(e.target.value)} className={inputClass}>
                    <option value="">Seleccionar proyecto…</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Columna / Estado */}
                <div>
                  <label className={labelClass}>Columna</label>
                  <select value={tkStatus} onChange={e => setTkStatus(e.target.value)} className={inputClass}>
                    {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'done').map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Prioridad */}
                <div>
                  <label className={labelClass}>Prioridad</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setTkPriority(val)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          tkPriority === val
                            ? val === 'urgent' || val === 'high'
                              ? 'bg-fp-punch-red border-fp-punch-red text-white'
                              : 'bg-fp-cerulean border-fp-cerulean text-white'
                            : 'border-gray-200 dark:border-fp-border-dark text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fecha límite */}
                <div>
                  <label className={labelClass}>Fecha límite</label>
                  <input type="date" value={tkDueDate} onChange={e => setTkDueDate(e.target.value)} className={inputClass} />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-fp-border-dark flex-shrink-0">
            <div>
              {isEditing && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 dark:text-fp-text-tertiary hover:text-fp-punch-red transition-colors"
                >
                  <Trash2 size={13} /> Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCreateModal(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs font-semibold text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={activeTab === 'event' ? handleSaveEvent : handleSaveTask}
                disabled={saving || (activeTab === 'event' ? !evTitle.trim() || !evDate : !tkTitle.trim() || !tkProjectId)}
                className="px-4 py-2 rounded-lg bg-fp-cerulean text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear'}
              </button>
            </div>
          </div>

          {/* Confirm delete dentro del modal de edición */}
          {deleteConfirm && isEditing && (
            <div className="absolute inset-0 bg-white/95 dark:bg-fp-card-dark/95 rounded-xl flex flex-col items-center justify-center gap-4 p-8">
              <Trash2 size={28} className="text-fp-punch-red" />
              <p className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew text-center">¿Eliminar este evento?</p>
              <p className="text-xs text-gray-400 dark:text-fp-text-tertiary text-center">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteEvent(editingEvent.id)}
                  disabled={saving}
                  className="px-5 py-2 bg-fp-punch-red text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-5 py-2 border border-gray-200 dark:border-fp-border-dark rounded-lg text-xs font-semibold text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render principal ──
  return (
    <div>
      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight flex items-center gap-2">
              <Calendar size={20} className="text-fp-cerulean" />
              Calendario
            </h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              Todas las fechas de la agencia en un solo lugar
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón + Nuevo */}
            <button
              onClick={() => openCreate(todayKey)}
              className="flex items-center gap-1.5 px-4 py-2 bg-fp-cerulean text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus size={16} /> Nuevo evento
            </button>

            {/* Selector de vista */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-fp-bg-dark rounded-lg p-1">
              {([
                ['year', 'Año'],
                ['month', 'Mes'],
                ['week', 'Semana'],
                ['agenda', 'Agenda'],
              ] as [ViewMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                    view === mode
                      ? 'bg-white dark:bg-fp-card-dark text-fp-cerulean shadow-sm'
                      : 'text-gray-400 dark:text-fp-text-secondary hover:text-fp-navy dark:hover:text-fp-honeydew'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Barra de navegación + filtros */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2">
            {view !== 'agenda' && (
              <>
                <button
                  onClick={() => navigate(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-fp-border-dark text-gray-400 dark:text-fp-text-secondary hover:text-fp-cerulean hover:border-fp-cerulean/50 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-fp-border-dark text-gray-400 dark:text-fp-text-secondary hover:text-fp-cerulean hover:border-fp-cerulean/50 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <button
              onClick={goToday}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-xs font-semibold text-gray-500 dark:text-fp-text-secondary hover:text-fp-cerulean hover:border-fp-cerulean/50 transition-colors"
            >
              Hoy
            </button>
            <h2 className="text-base font-semibold text-fp-navy dark:text-fp-honeydew ml-2 capitalize">
              {rangeLabel()}
            </h2>
          </div>

          {/* Filtros por fuente */}
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(SOURCE_CONFIG) as Source[]).map(source => {
              const cfg = SOURCE_CONFIG[source]
              const active = filters[source]
              return (
                <button
                  key={source}
                  onClick={() => setFilters(f => ({ ...f, [source]: !f[source] }))}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'border-transparent ' + cfg.pill
                      : 'border-gray-200 dark:border-fp-border-dark text-gray-300 dark:text-fp-text-tertiary'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${active ? cfg.dot : 'bg-gray-300 dark:bg-fp-text-tertiary'}`} />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-16 text-center">
            <RefreshCw size={22} className="text-fp-cerulean animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando calendario…</p>
          </div>
        ) : (
          <>
            {view === 'year' && <YearView />}
            {view === 'month' && <MonthView />}
            {view === 'week' && <WeekView />}
            {view === 'agenda' && <AgendaView />}
          </>
        )}
      </div>

      <CreateEditModal />
      <DetailModal />
      <DayModal />
    </div>
  )
}
