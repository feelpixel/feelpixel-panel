'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  title: string
  message: string | null
  link: string | null
  read: boolean
  created_at: string
}

interface Props {
  userId: string
}

export function NotificationBell({ userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.read).length

  // ── Load + realtime ────────────────────────────────────────────────────
  useEffect(() => {
    loadNotifications()

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ── Close on outside click ─────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) setNotifications(data)
  }

  async function handleClickNotification(notification: Notification) {
    // Mark as read
    if (!notification.read) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id)

      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      )
    }

    // Navigate
    if (notification.link) {
      router.push(notification.link)
    }

    setIsOpen(false)
  }

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `hace ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `hace ${days}d`
    return new Date(dateStr).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Bell button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={18} className="text-gray-400 dark:text-fp-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-fp-punch-red rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────────── */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-xl z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-fp-border-dark flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-fp-punch-red/10 text-fp-punch-red text-[10px] font-semibold">
                  {unreadCount} nueva{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-fp-cerulean hover:underline"
              >
                <CheckCheck size={12} />
                Marcar todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="text-gray-200 dark:text-fp-border-dark mx-auto mb-2" />
                <p className="text-xs text-gray-400 dark:text-fp-text-tertiary">
                  Sin notificaciones
                </p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-fp-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors ${
                    !n.read ? 'bg-fp-cerulean/5 dark:bg-fp-cerulean/10' : ''
                  }`}
                >
                  <div className="flex gap-2.5 items-start">
                    {/* Unread dot */}
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                      !n.read ? 'bg-fp-punch-red' : 'bg-transparent'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-fp-navy dark:text-fp-honeydew truncate">
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-[11px] text-gray-400 dark:text-fp-text-tertiary mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Clock size={9} className="text-gray-300 dark:text-fp-text-tertiary" />
                        <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
