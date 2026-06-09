'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { AccessDenied } from '@/components/AccessDenied'
import {
  Plus, Search, RefreshCw, X, Pencil, Trash2, Check,
  AlertCircle, Clock, DollarSign, TrendingUp, Package,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Service = {
  id: string
  name: string
  category: string
  cost: number
  currency: 'USD' | 'ARS'
  billing_cycle: 'monthly' | 'annual' | 'other'
  next_renewal: string | null
  payment_method: string | null
  status: 'active' | 'paused' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
}

type FormState = {
  name: string
  category: string
  cost: string
  currency: 'USD' | 'ARS'
  billing_cycle: 'monthly' | 'annual' | 'other'
  next_renewal: string
  payment_method: string
  status: 'active' | 'paused' | 'cancelled'
  notes: string
}

const emptyForm: FormState = {
  name: '',
  category: 'SaaS / Productividad',
  cost: '',
  currency: 'USD',
  billing_cycle: 'monthly',
  next_renewal: '',
  payment_method: '',
  status: 'active',
  notes: '',
}

const CATEGORIES = [
  'Hosting & Dominios',
  'IA',
  'SaaS / Productividad',
  'Marketing & Ads',
  'Comunicación',
  'Desarrollo',
  'Pagos & Finanzas',
  'Diseño / Stock',
  'Dropshipping',
  'Otros',
]

const STATUS_CONFIG = {
  active:    { label: 'Activo',     bg: 'bg-green-500/10',         text: 'text-green-500' },
  paused:    { label: 'Pausado',    bg: 'bg-amber-500/10',         text: 'text-amber-500' },
  cancelled: { label: 'Cancelado', bg: 'bg-fp-punch-red/10',       text: 'text-fp-punch-red' },
}

const CYCLE_LABEL = {
  monthly: 'Mensual',
  annual:  'Anual',
  other:   'Otro',
}

const SORT_OPTIONS = [
  { value: 'name_asc',     label: 'Nombre A-Z' },
  { value: 'cost_desc',    label: 'Costo mayor a menor' },
  { value: 'cost_asc',     label: 'Costo menor a mayor' },
  { value: 'renewal_asc',  label: 'Próxima renovación' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilRenewal(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function renewalColor(days: number | null): string {
  if (days === null) return ''
  if (days <= 7)  return 'text-fp-punch-red'
  if (days <= 30) return 'text-amber-500'
  return 'text-gray-400 dark:text-fp-text-tertiary'
}

function renewalLabel(days: number | null): string {
  if (days === null) return '—'
  if (days < 0)  return 'Vencido'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  return `${days}d`
}

function monthlyCost(s: Service): number {
  if (s.billing_cycle === 'monthly') return s.cost
  if (s.billing_cycle === 'annual')  return s.cost / 12
  return 0
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const supabase = createClient()
  const { can, loading: loadingPerms } = usePermissions()

  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterCat, setFilterCat]     = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy]           = useState('name_asc')
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<Service | null>(null)
  const [form, setForm]               = useState<FormState>(emptyForm)
  const [saving, setSaving]           = useState(false)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [error, setError]             = useState('')

  const fetchServices = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('services').select('*').order('name')
    setServices(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchServices() }, [fetchServices])

  // Permisos — siempre después de todos los hooks
  if (loadingPerms) return null
  if (!can('contabilidad')) return <AccessDenied />

  // ─── Lógica de filtrado/orden ────────────────────────────────────────────

  const canEdit   = can('contabilidad', 'edit')
  const canDelete = can('contabilidad', 'delete')

  const filtered = services
    .filter(s => filterCat === 'all' || s.category === filterCat)
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()) ||
      (s.payment_method || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name_asc')    return a.name.localeCompare(b.name)
      if (sortBy === 'cost_desc')   return b.cost - a.cost
      if (sortBy === 'cost_asc')    return a.cost - b.cost
      if (sortBy === 'renewal_asc') {
        if (!a.next_renewal) return 1
        if (!b.next_renewal) return -1
        return new Date(a.next_renewal).getTime() - new Date(b.next_renewal).getTime()
      }
      return 0
    })

  // ─── Stats ────────────────────────────────────────────────────────────────

  const active = services.filter(s => s.status === 'active')
  const monthlyUSD = active.filter(s => s.currency === 'USD').reduce((acc, s) => acc + monthlyCost(s), 0)
  const monthlyARS = active.filter(s => s.currency === 'ARS').reduce((acc, s) => acc + monthlyCost(s), 0)
  const annualUSD  = monthlyUSD * 12
  const annualARS  = monthlyARS * 12

  const upcomingRenewals = [...active]
    .filter(s => s.next_renewal)
    .sort((a, b) => new Date(a.next_renewal!).getTime() - new Date(b.next_renewal!).getTime())
    .slice(0, 3)

  // ─── Modal ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({
      name:           s.name,
      category:       s.category,
      cost:           String(s.cost),
      currency:       s.currency,
      billing_cycle:  s.billing_cycle,
      next_renewal:   s.next_renewal || '',
      payment_method: s.payment_method || '',
      status:         s.status,
      notes:          s.notes || '',
    })
    setError('')
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(emptyForm)
    setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return }
    if (!form.cost || isNaN(Number(form.cost))) { setError('El costo debe ser un número válido.'); return }
    setSaving(true)
    setError('')

    const payload = {
      name:           form.name.trim(),
      category:       form.category,
      cost:           Number(form.cost),
      currency:       form.currency,
      billing_cycle:  form.billing_cycle,
      next_renewal:   form.next_renewal || null,
      payment_method: form.payment_method.trim() || null,
      status:         form.status,
      notes:          form.notes.trim() || null,
    }

    if (editing) {
      const { error: err } = await supabase.from('services').update(payload).eq('id', editing.id)
      if (err) { setError('Error al guardar.'); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('services').insert(payload)
      if (err) { setError('Error al guardar.'); setSaving(false); return }
    }

    setSaving(false)
    closeModal()
    fetchServices()
  }

  async function handleDelete(id: string) {
    await supabase.from('services').delete().eq('id', id)
    setDeletingId(null)
    fetchServices()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Topbar */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight">Servicios recurrentes</h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {active.length} servicio{active.length !== 1 ? 's' : ''} activo{active.length !== 1 ? 's' : ''}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 transition-colors"
            >
              <Plus size={15} /> Nuevo servicio
            </button>
          )}
        </div>
      </div>

      <div className="p-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <DollarSign size={11} /> Mensual USD
            </div>
            <div className="text-2xl font-bold text-fp-cerulean">${monthlyUSD.toFixed(2)}</div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <DollarSign size={11} /> Mensual ARS
            </div>
            <div className="text-2xl font-bold text-fp-cerulean">AR${monthlyARS.toFixed(0)}</div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <TrendingUp size={11} /> Anual USD
            </div>
            <div className="text-2xl font-bold text-fp-navy dark:text-fp-honeydew">${annualUSD.toFixed(2)}</div>
          </div>
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl p-5">
            <div className="text-xs text-gray-500 dark:text-fp-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Package size={11} /> Servicios activos
            </div>
            <div className="text-2xl font-bold text-fp-navy dark:text-fp-honeydew">{active.length}</div>
          </div>
        </div>

        {/* Próximas renovaciones */}
        {upcomingRenewals.length > 0 && (
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl px-5 py-3 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-fp-navy dark:text-fp-honeydew flex-shrink-0">
              <Clock size={13} className="text-fp-cerulean" />
              Próximas renovaciones
            </div>
            {upcomingRenewals.map(s => {
              const days = daysUntilRenewal(s.next_renewal)
              return (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="text-fp-navy dark:text-fp-honeydew font-medium">{s.name}</span>
                  <span className="text-gray-400 dark:text-fp-text-tertiary">
                    {s.next_renewal ? new Date(s.next_renewal).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                  <span className={`font-semibold ${renewalColor(days)}`}>{renewalLabel(days)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark">
            <Search size={14} className="text-gray-400 dark:text-fp-text-secondary" />
            <input
              type="text"
              placeholder="Buscar servicio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew placeholder-gray-400 dark:placeholder-fp-text-tertiary w-44"
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
          >
            <option value="all">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="paused">Pausado</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(search || filterCat !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => { setSearch(''); setFilterCat('all'); setFilterStatus('all') }}
              className="text-xs text-gray-400 dark:text-fp-text-tertiary hover:text-fp-punch-red transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-center py-16 text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando servicios...</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
            <RefreshCw size={36} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">
              {search || filterCat !== 'all' || filterStatus !== 'all' ? 'Sin resultados' : 'No hay servicios todavía'}
            </h3>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mb-4">
              {search || filterCat !== 'all' || filterStatus !== 'all'
                ? 'Probá con otros filtros'
                : 'Agregá tu primer servicio para empezar a trackear los costos'}
            </p>
            {canEdit && !search && filterCat === 'all' && filterStatus === 'all' && (
              <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-fp-punch-red/10 text-fp-punch-red text-sm font-semibold hover:bg-fp-punch-red/20">
                <Plus size={14} className="inline mr-1" /> Crear servicio
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-gray-100 dark:border-fp-border-dark text-[10px] font-semibold text-gray-400 dark:text-fp-text-tertiary uppercase tracking-wider">
              <span>Servicio</span>
              <span>Ciclo</span>
              <span>Costo</span>
              <span>Renovación</span>
              <span>Estado</span>
              <span></span>
            </div>
            {filtered.map((s, idx) => {
              const sc = STATUS_CONFIG[s.status]
              const days = daysUntilRenewal(s.next_renewal)
              return (
                <div
                  key={s.id}
                  className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-3.5 ${
                    idx < filtered.length - 1 ? 'border-b border-gray-50 dark:border-fp-border-dark' : ''
                  } hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors`}
                >
                  {/* Nombre + categoría */}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew truncate">{s.name}</div>
                    <div className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">{s.category}</div>
                  </div>

                  {/* Ciclo */}
                  <div className="text-sm text-gray-500 dark:text-fp-text-secondary">
                    {CYCLE_LABEL[s.billing_cycle]}
                  </div>

                  {/* Costo */}
                  <div>
                    <span className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                      {s.currency === 'ARS' ? 'AR$' : '$'}{s.cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-fp-text-tertiary ml-1">{s.currency}</span>
                  </div>

                  {/* Renovación */}
                  <div>
                    {s.next_renewal ? (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-fp-text-secondary">
                          {new Date(s.next_renewal).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className={`text-[10px] font-semibold mt-0.5 ${renewalColor(days)}`}>
                          {days !== null && days <= 30 && <AlertCircle size={9} className="inline mr-0.5" />}
                          {renewalLabel(days)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-fp-text-tertiary">—</span>
                    )}
                  </div>

                  {/* Estado */}
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {canDelete && (
                      deletingId === s.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 rounded-lg text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors"
                            title="Confirmar"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"
                            title="Cancelar"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(s.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-fp-border-dark">
              <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew">
                {editing ? 'Editar servicio' : 'Nuevo servicio'}
              </h3>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <p className="text-xs text-fp-punch-red bg-fp-punch-red/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: ChatGPT Plus"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew placeholder-gray-300 dark:placeholder-fp-text-tertiary outline-none focus:border-fp-cerulean"
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Categoría</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Costo + Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Costo *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost}
                    onChange={e => setForm({ ...form, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew placeholder-gray-300 dark:placeholder-fp-text-tertiary outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Moneda</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm({ ...form, currency: e.target.value as 'USD' | 'ARS' })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
              </div>

              {/* Ciclo + Estado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Ciclo de facturación</label>
                  <select
                    value={form.billing_cycle}
                    onChange={e => setForm({ ...form, billing_cycle: e.target.value as FormState['billing_cycle'] })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  >
                    <option value="monthly">Mensual</option>
                    <option value="annual">Anual</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Estado</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value as FormState['status'] })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  >
                    <option value="active">Activo</option>
                    <option value="paused">Pausado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Próxima renovación + Método de pago */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Próxima renovación</label>
                  <input
                    type="date"
                    value={form.next_renewal}
                    onChange={e => setForm({ ...form, next_renewal: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Método de pago</label>
                  <input
                    type="text"
                    value={form.payment_method}
                    onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    placeholder="Ej: Visa terminada en 4242"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew placeholder-gray-300 dark:placeholder-fp-text-tertiary outline-none focus:border-fp-cerulean"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-fp-text-secondary mb-1.5">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Detalles del plan, link de administración, usuarios incluidos..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-fp-navy dark:text-fp-honeydew placeholder-gray-300 dark:placeholder-fp-text-tertiary outline-none focus:border-fp-cerulean resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-fp-border-dark">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm rounded-lg text-gray-500 dark:text-fp-text-secondary hover:bg-gray-100 dark:hover:bg-fp-hover-dark transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-fp-punch-red text-white font-medium hover:bg-fp-punch-red/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
