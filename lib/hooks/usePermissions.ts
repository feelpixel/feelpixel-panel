'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UserPermissions {
  module: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
}

export interface UsePermissionsResult {
  permissions: UserPermissions[]
  role: string | null
  loading: boolean
  can: (module: string, action?: 'view' | 'edit' | 'delete' | 'export') => boolean
  isAdmin: () => boolean
}

export function usePermissions(): UsePermissionsResult {
  const supabase = createClient()
  const [permissions, setPermissions] = useState<UserPermissions[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const userRole = session?.user?.app_metadata?.role || null
      setRole(userRole)

      const { data } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('profile_id', session?.user?.id)

      setPermissions(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function can(module: string, action: 'view' | 'edit' | 'delete' | 'export' = 'view'): boolean {
    // Los admins siempre tienen acceso a todo
    if (role === 'admin') return true
    const perm = permissions.find((p) => p.module === module)
    if (!perm) return false
    const map = {
      view: perm.can_view,
      edit: perm.can_edit,
      delete: perm.can_delete,
      export: perm.can_export,
    }
    return map[action]
  }

  function isAdmin(): boolean {
    return role === 'admin'
  }

  return { permissions, role, loading, can, isAdmin }
}