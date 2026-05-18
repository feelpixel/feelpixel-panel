'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import {
  Home,
  ClipboardList,
  RefreshCw,
  CheckCircle,
  Users,
  FolderOpen,
  Lock,
  Calendar,
  Calculator,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/projects', label: 'Proyectos', icon: ClipboardList },
  { href: '/dashboard/services', label: 'Servicios', icon: RefreshCw },
  { href: '/dashboard/tasks', label: 'Tareas', icon: CheckCircle },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users },
  { href: '/dashboard/files', label: 'Archivos', icon: FolderOpen },
  { href: '/dashboard/vault', label: 'Bóveda', icon: Lock },
  { href: '/dashboard/calendar', label: 'Calendario', icon: Calendar },
  { href: '/dashboard/accounting', label: 'Contabilidad', icon: Calculator },
]

interface SidebarProps {
  user: {
    full_name?: string | null
    email?: string
    avatar_url?: string | null
  } | null
}

export function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } bg-white dark:bg-fp-sidebar-dark border-r border-gray-200 dark:border-fp-border-dark flex flex-col transition-all duration-200 flex-shrink-0`}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-3 ${
          collapsed ? 'px-3 justify-center' : 'px-5'
        } h-16 border-b border-gray-200 dark:border-fp-border-dark cursor-pointer`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fp-punch-red to-fp-cerulean flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">FP</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">
              feel pixel
            </div>
            <div className="text-[10px] text-gray-400 dark:text-fp-text-tertiary font-mono">
              panel interno
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                collapsed ? 'justify-center' : ''
              } ${
                active
                  ? 'bg-fp-cerulean/10 text-fp-cerulean font-semibold'
                  : 'text-gray-500 dark:text-fp-text-secondary hover:bg-gray-100 dark:hover:bg-fp-hover-dark'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-fp-border-dark space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-fp-text-secondary hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
        </button>

        {/* User */}
        {user && !collapsed && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fp-navy to-fp-cerulean flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">
                {user.full_name?.[0] || user.email?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-fp-navy dark:text-fp-honeydew truncate">
                {user.full_name || 'Usuario'}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-fp-text-tertiary truncate">
                {user.email}
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-fp-text-tertiary hover:text-fp-punch-red hover:bg-red-50 dark:hover:bg-fp-punch-red/10 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={18} />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  )
}
