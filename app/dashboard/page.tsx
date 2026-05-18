import { createClient } from '@/lib/supabase/server'
import { Search, Bell } from 'lucide-react'
import Link from 'next/link'

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

  // Fetch tasks assigned to current user
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, projects(name)')
    .eq('assignee_id', user!.id)
    .neq('status', 'done')
    .order('priority', { ascending: true })
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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const priorityColors: Record<string, string> = {
    urgent: 'bg-fp-punch-red',
    high: 'bg-amber-500',
    medium: 'bg-fp-cerulean',
    low: 'bg-gray-400 dark:bg-fp-text-tertiary',
  }

  const statusLabels: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-fp-cerulean/10', text: 'text-fp-cerulean', label: 'Activo' },
    paused: { bg: 'bg-fp-punch-red/10', text: 'text-fp-punch-red', label: 'Pausado' },
    completed: { bg: 'bg-fp-frosted/10', text: 'text-fp-frosted', label: 'Completo' },
    draft: { bg: 'bg-gray-100 dark:bg-fp-text-tertiary/10', text: 'text-gray-500 dark:text-fp-text-tertiary', label: 'Borrador' },
  }

  return (
    <div>
      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">
              Dashboard
            </h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {today}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark text-sm text-gray-400 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark">
              <Search size={14} />
              <span>Buscar...</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-fp-hover-dark text-gray-400 dark:text-fp-text-tertiary">
                ⌘K
              </kbd>
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
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">
              Proyectos activos
            </div>
            <div className="text-3xl font-bold text-fp-cerulean">
              {activeProjects || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">
              Tareas pendientes
            </div>
            <div className="text-3xl font-bold text-fp-punch-red">
              {pendingTasks || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">
              Clientes
            </div>
            <div className="text-3xl font-bold text-fp-navy dark:text-fp-honeydew">
              {clientCount || 0}
            </div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5">
              Bienvenido
            </div>
            <div className="text-lg font-bold text-fp-navy dark:text-fp-honeydew truncate">
              {profile?.full_name || 'Usuario'}
            </div>
            <div className="text-xs text-gray-400 dark:text-fp-text-tertiary truncate">
              {profile?.role || 'member'}
            </div>
          </div>
        </div>

        {/* Projects + Tasks */}
        <div className="flex gap-4 mb-6">
          {/* Projects */}
          <div className="flex-[2] bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
              <h2 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                Proyectos
              </h2>
              <Link
                href="/dashboard/projects"
                className="text-xs px-3 py-1 rounded-lg bg-fp-punch-red/10 text-fp-punch-red font-semibold hover:bg-fp-punch-red/20 transition-colors"
              >
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
                    className="flex items-center gap-4 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew truncate">
                        {project.name}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
                        {project.clients?.name || (
                          <span className="italic text-fp-cerulean">Proyecto interno</span>
                        )}
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
                <Link href="/dashboard/projects" className="text-fp-cerulean hover:underline">
                  Crear el primero
                </Link>
              </div>
            )}
          </div>

          {/* Tasks */}
          <div className="flex-1 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
              <h2 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                Mis tareas
              </h2>
              <span className="text-xs text-gray-400 dark:text-fp-text-tertiary">
                {tasks?.length || 0} pendientes
              </span>
            </div>
            {tasks && tasks.length > 0 ? (
              tasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors cursor-pointer"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      priorityColors[task.priority] || priorityColors.medium
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
                      {task.projects?.name}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-fp-text-tertiary">
                Sin tareas pendientes
              </div>
            )}
          </div>
        </div>

        {/* Empty state hint */}
        {(!projects || projects.length === 0) && (
          <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fp-punch-red/20 to-fp-cerulean/20 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">🚀</span>
            </div>
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">
              Tu panel está listo
            </h3>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary max-w-sm mx-auto">
              Empezá creando tu primer cliente en la sección Clientes, 
              y después tu primer proyecto. Los datos van a aparecer acá automáticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
