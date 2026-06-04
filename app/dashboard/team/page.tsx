'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UserCog,
  Search,
  Plus,
  X,
  Check,
  Shield,
  User,
  Briefcase,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { AccessDenied } from '@/components/AccessDenied'

// ── Tipos ─────────────────────────────────────────────────────
type UserRole = 'admin' | 'member' | 'client'

interface TeamMember {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  created_at: string
}

interface Permission {
  module: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
}

const MODULES = [
  { key: 'proyectos', label: 'Proyectos' },
  { key: 'boveda', label: 'Bóveda' },
  { key: 'archivos', label: 'Archivos' },
  { key: 'tareas', label: 'Tareas' },
  { key: 'contabilidad', label: 'Contabilidad' },
  { key: 'equipo', label: 'Equipo' },
]

const DEFAULT_PERMISSIONS: Permission[] = MODULES.map((m) => ({
  module: m.key,
  can_view: true,
  can_edit: false,
  can_delete: false,
  can_export: false,
}))

// ── Helpers ───────────────────────────────────────────────────
function roleBadge(role: UserRole) {
  const map = {
    admin: 'bg-fp-punch-red/10 text-fp-punch-red border border-fp-punch-red/20',
    member: 'bg-fp-cerulean/10 text-fp-cerulean border border-fp-cerulean/20',
    client: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
  }
  const label = { admin: 'Admin', member: 'Member', client: 'Client' }
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${map[role]}`}>
      {label[role]}
    </span>
  )
}

function Avatar({ member }: { member: TeamMember }) {
  const initial = (member.full_name?.[0] || member.email[0] || '?').toUpperCase()
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.full_name || member.email}
        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
      />
    )
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fp-navy to-fp-cerulean flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-semibold">{initial}</span>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────
export default function TeamPage() {
  const supabase = createClient()
  const { isAdmin, loading: loadingPerms } = usePermissions()

  if (loadingPerms) return null
  if (!isAdmin()) return <AccessDenied />

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<'all' | UserRole>('all')

  // Modal invitar
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('member')
  const [invitePerms, setInvitePerms] = useState<Permission[]>(DEFAULT_PERMISSIONS)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // Modal permisos (editar usuario existente)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('member')
  const [editPerms, setEditPerms] = useState<Permission[]>(DEFAULT_PERMISSIONS)
  const [saving, setSaving] = useState(false)

  // Modal confirmar eliminar
  const [deletingMember, setDeletingMember] = useState<TeamMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Cargar miembros ──────────────────────────────────────────
  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, created_at')
      .order('created_at', { ascending: true })
    setMembers((data as TeamMember[]) || [])
    setLoading(false)
  }

  async function loadPermissions(profileId: string): Promise<Permission[]> {
    const { data } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('profile_id', profileId)

    if (!data || data.length === 0) return DEFAULT_PERMISSIONS

    return MODULES.map((m) => {
      const found = data.find((p) => p.module === m.key)
      return found
        ? {
            module: m.key,
            can_view: found.can_view,
            can_edit: found.can_edit,
            can_delete: found.can_delete,
            can_export: found.can_export,
          }
        : { module: m.key, can_view: true, can_edit: false, can_delete: false, can_export: false }
    })
  }

  // ── Abrir modal edición ──────────────────────────────────────
  async function openEdit(member: TeamMember) {
    setEditingMember(member)
    setEditRole(member.role)
    const perms = await loadPermissions(member.id)
    setEditPerms(perms)
  }

  // ── Guardar edición ──────────────────────────────────────────
  async function saveEdit() {
    if (!editingMember) return
    setSaving(true)
    await fetch('/api/admin/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        userId: editingMember.id,
        role: editRole,
        permissions: editPerms,
      }),
    })
    setSaving(false)
    setEditingMember(null)
    loadMembers()
  }

  // ── Invitar ──────────────────────────────────────────────────
  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    const res = await fetch('/api/admin/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invite',
        email: inviteEmail.trim(),
        fullName: inviteName.trim(),
        role: inviteRole,
        permissions: invitePerms,
      }),
    })
    const data = await res.json()
    setInviting(false)
    if (data.error) {
      setInviteError(data.error)
    } else {
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('member')
      setInvitePerms(DEFAULT_PERMISSIONS)
      loadMembers()
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────
  async function handleDelete() {
    if (!deletingMember) return
    setDeleting(true)
    await fetch('/api/admin/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', userId: deletingMember.id }),
    })
    setDeleting(false)
    setDeletingMember(null)
    loadMembers()
  }

  // ── Toggle permiso ───────────────────────────────────────────
  function togglePerm(
    perms: Permission[],
    setPerms: (p: Permission[]) => void,
    moduleKey: string,
    field: keyof Omit<Permission, 'module'>
  ) {
    setPerms(
      perms.map((p) =>
        p.module === moduleKey ? { ...p, [field]: !p[field] } : p
      )
    )
  }

  // ── Filtros ──────────────────────────────────────────────────
  const filtered = members.filter((m) => {
    const matchSearch =
      !search ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      (m.full_name || '').toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'all' || m.role === filterRole
    return matchSearch && matchRole
  })

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="text-fp-cerulean" size={24} />
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew">Equipo</h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-secondary">
              {members.length} {members.length === 1 ? 'usuario' : 'usuarios'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-fp-punch-red hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Invitar usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-lg text-fp-navy dark:text-fp-honeydew placeholder-gray-400 focus:outline-none focus:border-fp-cerulean"
          />
        </div>
        {(['all', 'admin', 'member', 'client'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setFilterRole(r)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterRole === r
                ? 'bg-fp-cerulean text-white'
                : 'bg-white dark:bg-fp-card-dark text-gray-500 dark:text-fp-text-secondary border border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean'
            }`}
          >
            {r === 'all' ? 'Todos' : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 dark:text-fp-text-secondary text-sm">
            Cargando equipo...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 dark:text-fp-text-secondary text-sm">
            No hay usuarios que coincidan.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-fp-border-dark">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 dark:text-fp-text-secondary uppercase tracking-wider">
                  Usuario
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 dark:text-fp-text-secondary uppercase tracking-wider">
                  Rol
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 dark:text-fp-text-secondary uppercase tracking-wider hidden md:table-cell">
                  Desde
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-fp-border-dark">
              {filtered.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar member={member} />
                      <div>
                        <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew">
                          {member.full_name || '—'}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-fp-text-secondary">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{roleBadge(member.role)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-400 dark:text-fp-text-secondary">
                      {new Date(member.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(member)}
                        className="px-3 py-1.5 text-xs text-fp-cerulean hover:bg-fp-cerulean/10 rounded-lg transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeletingMember(member)}
                        className="p-1.5 text-gray-400 hover:text-fp-punch-red hover:bg-red-50 dark:hover:bg-fp-punch-red/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL INVITAR ─────────────────────────────────────── */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-fp-border-dark">
              <h2 className="font-semibold text-fp-navy dark:text-fp-honeydew">Invitar usuario</h2>
              <button onClick={() => setShowInvite(false)}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Datos básicos */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ej: Juan García"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-fp-bg-dark border border-gray-200 dark:border-fp-border-dark rounded-lg text-fp-navy dark:text-fp-honeydew placeholder-gray-400 focus:outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1">
                    Email <span className="text-fp-punch-red">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="juan@ejemplo.com"
                    className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-fp-bg-dark border border-gray-200 dark:border-fp-border-dark rounded-lg text-fp-navy dark:text-fp-honeydew placeholder-gray-400 focus:outline-none focus:border-fp-cerulean"
                  />
                </div>
              </div>

              {/* Selector de rol */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-2">
                  Rol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'admin', label: 'Admin', icon: Shield, desc: 'Control total' },
                    { value: 'member', label: 'Member', icon: User, desc: 'Acceso estándar' },
                    { value: 'client', label: 'Client', icon: Briefcase, desc: 'Portal cliente' },
                  ].map((r) => {
                    const Icon = r.icon
                    const selected = inviteRole === r.value
                    return (
                      <button
                        key={r.value}
                        onClick={() => setInviteRole(r.value as UserRole)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                          selected
                            ? 'border-fp-cerulean bg-fp-cerulean/10'
                            : 'border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean/50'
                        }`}
                      >
                        <Icon size={18} className={selected ? 'text-fp-cerulean' : 'text-gray-400'} />
                        <span className={`text-xs font-medium ${selected ? 'text-fp-cerulean' : 'text-gray-500 dark:text-fp-text-secondary'}`}>
                          {r.label}
                        </span>
                        <span className="text-[10px] text-gray-400">{r.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Matriz de permisos */}
              <PermissionsMatrix perms={invitePerms} setPerms={setInvitePerms} togglePerm={togglePerm} />

              {inviteError && (
                <p className="text-xs text-fp-punch-red bg-red-50 dark:bg-fp-punch-red/10 px-3 py-2 rounded-lg">
                  {inviteError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-5 py-2 bg-fp-punch-red hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {inviting ? 'Enviando...' : 'Enviar invitación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR ──────────────────────────────────────── */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-fp-border-dark">
              <div className="flex items-center gap-3">
                <Avatar member={editingMember} />
                <div>
                  <h2 className="font-semibold text-fp-navy dark:text-fp-honeydew text-sm">
                    {editingMember.full_name || editingMember.email}
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-fp-text-secondary">{editingMember.email}</p>
                </div>
              </div>
              <button onClick={() => setEditingMember(null)}>
                <X size={18} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Cambiar rol */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-2">
                  Rol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'admin', label: 'Admin', icon: Shield, desc: 'Control total' },
                    { value: 'member', label: 'Member', icon: User, desc: 'Acceso estándar' },
                    { value: 'client', label: 'Client', icon: Briefcase, desc: 'Portal cliente' },
                  ].map((r) => {
                    const Icon = r.icon
                    const selected = editRole === r.value
                    return (
                      <button
                        key={r.value}
                        onClick={() => setEditRole(r.value as UserRole)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                          selected
                            ? 'border-fp-cerulean bg-fp-cerulean/10'
                            : 'border-gray-200 dark:border-fp-border-dark hover:border-fp-cerulean/50'
                        }`}
                      >
                        <Icon size={18} className={selected ? 'text-fp-cerulean' : 'text-gray-400'} />
                        <span className={`text-xs font-medium ${selected ? 'text-fp-cerulean' : 'text-gray-500 dark:text-fp-text-secondary'}`}>
                          {r.label}
                        </span>
                        <span className="text-[10px] text-gray-400">{r.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Matriz de permisos */}
              <PermissionsMatrix perms={editPerms} setPerms={setEditPerms} togglePerm={togglePerm} />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-5 py-2 bg-fp-cerulean hover:bg-fp-navy disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR ────────────────────────────────────── */}
      {deletingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-fp-navy dark:text-fp-honeydew">¿Eliminar usuario?</h2>
            <p className="text-sm text-gray-500 dark:text-fp-text-secondary">
              Vas a eliminar a <strong className="text-fp-navy dark:text-fp-honeydew">{deletingMember.full_name || deletingMember.email}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingMember(null)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 bg-fp-punch-red hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-componente: Matriz de permisos ────────────────────────
function PermissionsMatrix({
  perms,
  setPerms,
  togglePerm,
}: {
  perms: Permission[]
  setPerms: (p: Permission[]) => void
  togglePerm: (
    perms: Permission[],
    setPerms: (p: Permission[]) => void,
    moduleKey: string,
    field: keyof Omit<Permission, 'module'>
  ) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-fp-navy dark:text-fp-honeydew hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors"
      >
        Permisos por módulo
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-fp-border-dark">
          <div className="grid grid-cols-5 px-4 py-2 bg-gray-50 dark:bg-fp-bg-dark">
            <span className="text-xs text-gray-400 col-span-1">Módulo</span>
            {(['can_view', 'can_edit', 'can_delete', 'can_export'] as const).map((f) => (
              <span key={f} className="text-xs text-gray-400 text-center">
                {f === 'can_view' ? 'Ver' : f === 'can_edit' ? 'Editar' : f === 'can_delete' ? 'Borrar' : 'Export'}
              </span>
            ))}
          </div>
          {MODULES.map((m) => {
            const perm = perms.find((p) => p.module === m.key)!
            return (
              <div
                key={m.key}
                className="grid grid-cols-5 px-4 py-2.5 border-t border-gray-50 dark:border-fp-border-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark"
              >
                <span className="text-xs text-fp-navy dark:text-fp-honeydew col-span-1 flex items-center">
                  {m.label}
                </span>
                {(['can_view', 'can_edit', 'can_delete', 'can_export'] as const).map((field) => (
                  <div key={field} className="flex items-center justify-center">
                    <button
                      onClick={() => togglePerm(perms, setPerms, m.key, field)}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                        perm[field]
                          ? 'bg-fp-cerulean border-fp-cerulean'
                          : 'border-gray-300 dark:border-fp-border-dark hover:border-fp-cerulean'
                      }`}
                    >
                      {perm[field] && <Check size={11} className="text-white" />}
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}