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
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Source = 'task' | 'project' | 'service' | 'event'
type ViewMode = 'year' | 'month' | 'week' | 'agenda'

interface CalItem {
  id: string
  source: Source
  dateKey: string // 'YYYY-MM-DD' (fecha local)
  time: string | null // 'HH:MM' o null si es todo el día / sin hora
  title: string
  subtitle: string
  urgent: boolean
  raw: any
}

// ─── Helpers de fechas (siempre en hora local) ───────────────────────────────

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Parsea 'YYYY-MM-DD' como fecha LOCAL (evita el corrimiento de zona horaria)
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = copy.getDay() // 0=Dom..6=Sáb
  const diff = day === 0 ? 6 : day - 1 // lunes primero
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

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CalItem[]>([])
  const [profiles, setProfiles] = useState<Record<string, string>>({})

  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [filters, setFilters] = useState<Record<Source, boolean>>({
    task: true,
    project: true,
    service: true,
    event: true,
  })

  const [selected, setSelected] = useState<CalItem | null>(null)
  const [dayModal, setDayModal] = useState<string | null>(null)

  const todayKey = keyOf(new Date())

  // ── Carga de datos ──
  useEffect(() => {
    async function load() {
      setLoading(true)

      const [tasksRes, projectsRes, servicesRes, eventsRes, profilesRes] = await Promise.all([
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
          .select('id, full_name'),
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
      for (const pr of profilesRes.data || []) {
        const profile: any = pr
        profileMap[profile.id] = profile.full_name || 'Usuario'
      }

      setItems(built)
      setProfiles(profileMap)
      setLoading(false)
    }
    load()
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
  function goToday() {
    setCursor(new Date())
  }

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

  // ── Render de un chip de evento ──
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
                className={`min-h-[92px] border-b border-r border-gray-50 dark:border-fp-border-dark p-1 transition-colors ${isToday ? 'bg-fp-cerulean/5' : ''}`}
              >
                <div className="flex justify-end mb-0.5">
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-medium ${
                    isToday
                      ? 'bg-fp-cerulean text-white'
                      : 'text-fp-navy dark:text-fp-honeydew'
                  }`}>
                    {day}
                  </span>
                </div>
                {dayItems.slice(0, 3).map(item => (
                  <ItemPill key={item.id} item={item} />
                ))}
                {extra > 0 && (
                  <button
                    onClick={() => setDayModal(key)}
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
                <div className="flex-1 p-1 space-y-1">
                  {dayItems.length === 0 ? (
                    <div className="h-full" />
                  ) : (
                    dayItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className={`w-full text-left px-1.5 py-1 rounded text-[10px] font-medium transition-opacity hover:opacity-75 ${pillClass(item)}`}
                      >
                        {item.time && <div className="opacity-70 text-[9px]">{item.time}</div>}
                        <div className="truncate">{item.title}</div>
                      </button>
                    ))
                  )}
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
                        isToday
                          ? 'bg-fp-cerulean text-white font-semibold'
                          : 'text-fp-navy dark:text-fp-honeydew'
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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
        <div
          className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl w-full max-w-md p-5"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2 ${pillClass(item)}`}>
                {item.source === 'task' && item.urgent ? `${cfg.label} · ${PRIORITY_LABELS[raw.priority] || ''}` : cfg.label}
              </span>
              <h3 className="text-base font-semibold text-fp-navy dark:text-fp-honeydew break-words">{item.title}</h3>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-fp-punch-red transition-colors flex-shrink-0">
              <X size={18} />
            </button>
          </div>

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
                  <Link
                    href={`/dashboard/projects/${raw.project_id}`}
                    className="inline-flex items-center gap-1.5 text-fp-cerulean hover:underline text-xs font-semibold mt-1"
                  >
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
                <Link
                  href={`/dashboard/projects/${raw.id}`}
                  className="inline-flex items-center gap-1.5 text-fp-cerulean hover:underline text-xs font-semibold mt-1"
                >
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
                <Link
                  href="/dashboard/services"
                  className="inline-flex items-center gap-1.5 text-fp-cerulean hover:underline text-xs font-semibold mt-1"
                >
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
                <p className="text-[10px] text-gray-400 dark:text-fp-text-tertiary pt-1">
                  La creación y edición de eventos llega en la próxima actualización.
                </p>
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
            <button onClick={() => setDayModal(null)} className="text-gray-400 hover:text-fp-punch-red transition-colors">
              <X size={16} />
            </button>
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

      <DetailModal />
      <DayModal />
    </div>
  )
}
