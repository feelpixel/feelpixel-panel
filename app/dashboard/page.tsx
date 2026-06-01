import { createClient } from '@/lib/supabase/server'
import { Search, Bell, Calendar, Clock, AlertCircle, FolderOpen, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

// ── Mini Calendar (server-rendered, current month) ────────────────────────
function MiniCalendar({ markedDates }: { markedDates: string[] }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const dayNames = ['Lu','Ma','Mi','Ju','Vi','Sá','Do']

  // First day of month (0=Sunday..6=Saturday → convert to Mon-first)
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build set of days that have deadlines
  const markedSet = new Set(
    markedDates
      .map(d => new Date(d))
      .filter(d => d.getFullYear() === year && d.getMonth() === month)
      .map(d => d.getDate())
  )

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-fp-cerulean" />
        <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
          {monthNames[month]} {year}
        </h3>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 dark:text-fp-text-tertiary py-0.5">
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isToday = day === today
          const hasDeadline = markedSet.has(day)
          return (
            <div key={i} className="flex flex-col items-center py-0.5">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-medium transition-colors
                ${isToday ? 'bg-fp-cerulean text-white' : 'text-fp-navy dark:text-fp-honeydew hover:bg-gray-100 dark:hover:bg-fp-hover-dark'}
              `}>
                {day}
              </span>
              {hasDeadline && (
                <span className={`w-1 h-1 rounded-full mt-0.5 ${isToday ? 'bg-white' : 'bg-fp-punch-red'}`} />
              )}
            </div>
          )
        })}
      </div>
      {markedSet.size > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-fp-border-dark flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-fp-punch-red flex-shrink-0" />
          <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">
            {markedSet.size} fecha{markedSet.size > 1 ? 's' : ''} límite este mes
          </span>
        </div>
      )}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  // Fetch projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*, clients(name)')
    .order('updated_at', { ascending: false })
    .limit(5)

  // Fetch ALL tasks with due dates for the calendar
  const { data: tasksWithDates } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority, status, project_id, projects(name)')
    .not('due_date', 'is', null)
    .neq('status', 'done')
    .order('due_date', { ascending: true })

  // Fetch tasks assigned to current user (for "Mis tareas")
  const { data: myTasks } = await supabase
    .from('tasks')
    .select('*, projects(name)')
    .contains('assignees', [user!.id])
    .neq('status', 'done')
    .order('due_date', { ascending: true })
    .limit(5)

  // Counts
  const { count: activeProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: pendingTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .neq('status', 'done')

  const { count: clientCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  // Upcoming deadlines: tasks due in the next 14 days
  const nowDate = new Date()
  const in14 = new Date(nowDate)
  in14.setDate(in14.getDate() + 14)
  const upcoming = (tasksWithDates || []).filter(t => {
    const d = new Date(t.due_date!)
    return d >= nowDate && d <= in14
  }).slice(0, 6)

  // All due dates for calendar markers
  const allDueDates = (tasksWithDates || []).map(t => t.due_date!)

  const priorityConfig: Record<string, { dot: string; label: string }> = {
    urgent: { dot: 'bg-fp-punch-red', label: 'Urgente' },
    high:   { dot: 'bg-amber-500', label: 'Alta' },
    medium: { dot: 'bg-fp-cerulean', label: 'Media' },
    low:    { dot: 'bg-gray-400', label: 'Baja' },
  }

  const statusLabels: Record<string, { bg: string; text: string; label: string }> = {
    active:    { bg: 'bg-fp-cerulean/10',                       text: 'text-fp-cerulean', label: 'Activo' },
    paused:    { bg: 'bg-fp-punch-red/10',                      text: 'text-fp-punch-red', label: 'Pausado' },
    completed: { bg: 'bg-fp-frosted/10',                         text: 'text-fp-frosted', label: 'Completo' },
    draft:     { bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10', text: 'text-gray-500 dark:text-fp-text-tertiary', label: 'Borrador' },
  }

  function daysUntil(dateStr: string) {
    const d = new Date(dateStr)
    const diff = Math.ceil((d.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Mañana'
    return `En ${diff} días`
  }

  function urgencyColor(dateStr: string) {
    const diff = Math.ceil((new Date(dateStr).getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff <= 1) return 'text-fp-punch-red'
    if (diff <= 3) return 'text-amber-500'
    return 'text-gray-400 dark:text-fp-text-tertiary'
  }

  return (
    <div>
      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">Dashboard</h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5 capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm text-gray-400 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark">
              <Search size={14} />
              <span>Buscar...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-fp-hover-dark text-gray-400 dark:text-fp-text-tertiary">⌘K</kbd>
            </div>
            <div className="relative">
              <Bell size={18} className="text-gray-400 dark:text-fp-text-secondary" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fp-navy to-fp-cerulean flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {profile?.full_name?.[0] || '?'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">Proyectos activos</div>
            <div className="text-3xl font-bold text-fp-cerulean">{activeProjects || 0}</div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">Tareas pendientes</div>
            <div className="text-3xl font-bold text-fp-punch-red">{pendingTasks || 0}</div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">Clientes</div>
            <div className="text-3xl font-bold text-fp-navy dark:text-fp-honeydew">{clientCount || 0}</div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">Bienvenido</div>
            <div className="text-lg font-bold text-fp-navy dark:text-fp-honeydew truncate">{profile?.full_name || 'Usuario'}</div>
            <div className="text-xs text-gray-400 dark:text-fp-text-tertiary truncate">{profile?.role || 'member'}</div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">

          {/* Left col: Projects + My Tasks */}
          <div className="col-span-2 space-y-6">

            {/* Projects */}
            <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
                <h2 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Proyectos recientes</h2>
                <Link href="/dashboard/projects" className="text-xs px-3 py-1 rounded-lg bg-fp-punch-red/10 text-fp-punch-red font-semibold hover:bg-fp-punch-red/20 transition-colors">
                  + Nuevo
                </Link>
              </div>
              {projects && projects.length > 0 ? (
                projects.map((project: any) => {
                  const status = statusLabels[project.status] || statusLabels.draft
                  return (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors last:border-0"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fp-cerulean/20 to-fp-navy/20 flex items-center justify-center flex-shrink-0">
                        <FolderOpen size={12} className="text-fp-cerulean" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew truncate">{project.name}</div>
                        <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
                          {project.clients?.name || <span className="italic text-fp-cerulean">Proyecto interno</span>}
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </Link>
                  )
                })
              ) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-fp-text-tertiary">
                  No hay proyectos todavía.{' '}
                  <Link href="/dashboard/projects" className="text-fp-cerulean hover:underline">Crear el primero</Link>
                </div>
              )}
            </div>

            {/* My Tasks */}
            <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
                <h2 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Mis tareas</h2>
                <span className="text-xs text-gray-400 dark:text-fp-text-tertiary">{myTasks?.length || 0} pendientes</span>
              </div>
              {myTasks && myTasks.length > 0 ? (
                myTasks.map((task: any) => {
                  const pc = priorityConfig[task.priority] || priorityConfig.medium
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors cursor-pointer last:border-0"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.dot}`} title={pc.label} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{task.title}</div>
                        <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">{task.projects?.name}</div>
                      </div>
                      {task.due_date && (
                        <span className={`text-[10px] font-medium flex-shrink-0 ${urgencyColor(task.due_date)}`}>
                          {daysUntil(task.due_date)}
                        </span>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-fp-text-tertiary">
                  Sin tareas pendientes asignadas
                </div>
              )}
            </div>
          </div>

          {/* Right col: Calendar + Upcoming deadlines */}
          <div className="space-y-4">

            {/* Mini calendar */}
            <MiniCalendar markedDates={allDueDates} />

            {/* Upcoming deadlines */}
            <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-fp-border-dark flex items-center gap-2">
                <AlertCircle size={14} className="text-fp-punch-red" />
                <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">Próximas fechas límite</h3>
              </div>
              {upcoming.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <CheckCircle2 size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 dark:text-fp-text-tertiary">Sin vencimientos en los próximos 14 días</p>
                </div>
              ) : (
                <div>
                  {upcoming.map((task: any) => {
                    const pc = priorityConfig[task.priority] || priorityConfig.medium
                    const diff = Math.ceil((new Date(task.due_date).getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))
                    const isUrgent = diff <= 1
                    const isWarning = diff <= 3 && diff > 1
                    return (
                      <div key={task.id} className={`px-4 py-2.5 border-b border-gray-50 dark:border-fp-border-dark last:border-0 ${isUrgent ? 'bg-fp-punch-red/5' : ''}`}>
                        <div className="flex items-start gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${pc.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-fp-navy dark:text-fp-honeydew truncate">{task.title}</p>
                            {task.projects?.name && (
                              <p className="text-[10px] text-gray-400 dark:text-fp-text-tertiary truncate">{task.projects.name}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-[10px] font-semibold ${isUrgent ? 'text-fp-punch-red' : isWarning ? 'text-amber-500' : 'text-gray-400 dark:text-fp-text-tertiary'}`}>
                              {daysUntil(task.due_date)}
                            </p>
                            <p className="text-[9px] text-gray-400 dark:text-fp-text-tertiary">
                              {new Date(task.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="px-4 py-2 border-t border-gray-100 dark:border-fp-border-dark">
                    <Link href="/dashboard/tasks" className="text-[10px] text-fp-cerulean hover:underline">Ver todas las tareas →</Link>
                  </div>
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 dark:text-fp-text-tertiary uppercase tracking-wider mb-3">Accesos rápidos</h3>
              <div className="space-y-1">
                {[
                  { href: '/dashboard/projects', label: '📁 Proyectos' },
                  { href: '/dashboard/clients', label: '👥 Clientes' },
                  { href: '/dashboard/files', label: '📎 Archivos' },
                  { href: '/dashboard/vault', label: '🔐 Bóveda' },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-fp-navy dark:text-fp-honeydew hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Empty state hint */}
        {(!projects || projects.length === 0) && (
          <div className="mt-6 bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fp-punch-red/20 to-fp-cerulean/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🚀</span>
            </div>
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">Tu panel está listo</h3>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary max-w-sm mx-auto">
              Empezá creando tu primer cliente en la sección Clientes, y después tu primer proyecto. Los datos van a aparecer acá automáticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
