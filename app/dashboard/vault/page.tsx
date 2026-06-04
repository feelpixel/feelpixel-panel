'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Lock, Plus, Eye, EyeOff, Copy, Check, Search, Filter,
  Server, Share2, BarChart2, Code, Mail, Megaphone, Palette, MoreHorizontal,
  ExternalLink, Trash2, Edit2, X, ChevronDown, Globe, User, KeyRound,
  Building2, Loader2, Bot,
} from 'lucide-react'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { AccessDenied } from '@/components/AccessDenied'

type Category = { id: string; name: string; icon: string; sort_order: number }
type Client = { id: string; name: string }
type Credential = {
  id: string; name: string; username: string | null; password_encrypted: string | null
  url: string | null; notes: string | null; category_id: string | null; client_id: string | null
  login_with_google: boolean; created_at: string; updated_at: string
  credential_categories?: Category | null; clients?: Client | null
}
type FormData = {
  name: string; username: string; password_encrypted: string; url: string; notes: string
  category_id: string; client_id: string; login_with_google: boolean
}

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server, 'share-2': Share2, 'chart-bar': BarChart2, code: Code,
  mail: Mail, megaphone: Megaphone, dots: MoreHorizontal, palette: Palette, bot: Bot,
}
function getCategoryIcon(icon: string): React.ElementType { return ICON_MAP[icon] || Lock }

const CATEGORY_COLORS: Record<string, string> = {
  server: 'text-fp-cerulean bg-fp-cerulean/10', 'share-2': 'text-purple-400 bg-purple-400/10',
  'chart-bar': 'text-amber-400 bg-amber-400/10', code: 'text-emerald-400 bg-emerald-400/10',
  mail: 'text-blue-400 bg-blue-400/10', megaphone: 'text-orange-400 bg-orange-400/10',
  dots: 'text-fp-text-secondary bg-fp-text-secondary/10', palette: 'text-pink-400 bg-pink-400/10',
  bot: 'text-violet-400 bg-violet-400/10',
}
function getCategoryColor(icon: string): string {
  return CATEGORY_COLORS[icon] || 'text-fp-text-secondary bg-fp-text-secondary/10'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr), now = new Date()
  const diffH = (now.getTime() - d.getTime()) / (1000 * 60 * 60)
  if (diffH < 1) return 'Hace un momento'
  if (diffH < 24) return `Hace ${Math.floor(diffH)}h`
  if (diffH < 48) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function GoogleBadge({ small = false }: { small?: boolean }) {
  const s = small ? 12 : 15
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

export default function VaultPage() {
  const supabase = createClient()
  const { can, loading: loadingPerms } = usePermissions()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showModalPass, setShowModalPass] = useState(false)
  const [form, setForm] = useState<FormData>({
    name: '', username: '', password_encrypted: '', url: '', notes: '',
    category_id: '', client_id: '', login_with_google: false,
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [credRes, catRes, cliRes] = await Promise.all([
      supabase.from('credentials').select('*, credential_categories(*), clients(id, name)').order('updated_at', { ascending: false }),
      supabase.from('credential_categories').select('*').order('sort_order'),
      supabase.from('clients').select('id, name').order('name'),
    ])
    setCredentials((credRes.data as unknown as Credential[]) || [])
    setCategories(catRes.data || [])
    setClients((cliRes.data as unknown as Client[]) || [])
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const h = () => { setShowCatDropdown(false); setShowClientDropdown(false) }
    window.addEventListener('click', h); return () => window.removeEventListener('click', h)
  }, [])

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(key); setTimeout(() => setCopiedField(null), 1500)
  }
  const toggleReveal = (id: string) => {
    const next = new Set(revealedIds)
    if (next.has(id)) next.delete(id); else next.add(id); setRevealedIds(next)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', username: '', password_encrypted: '', url: '', notes: '', category_id: '', client_id: '', login_with_google: false })
    setShowModalPass(false); setShowModal(true)
  }
  const openEdit = (cred: Credential) => {
    setEditingId(cred.id)
    setForm({
      name: cred.name, username: cred.username || '', password_encrypted: cred.password_encrypted || '',
      url: cred.url || '', notes: cred.notes || '', category_id: cred.category_id || '',
      client_id: cred.client_id || '', login_with_google: cred.login_with_google || false,
    })
    setShowModalPass(false); setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditingId(null) }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      username: form.login_with_google ? null : (form.username || null),
      password_encrypted: form.login_with_google ? null : (form.password_encrypted || null),
      url: form.url || null, notes: form.notes || null,
      category_id: form.category_id || null, client_id: form.client_id || null,
      login_with_google: form.login_with_google,
    }
    if (editingId) {
      await supabase.from('credentials').update(payload).eq('id', editingId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('credentials').insert({ ...payload, created_by: user?.id })
    }
    setSaving(false); closeModal(); fetchData()
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    await supabase.from('credentials').delete().eq('id', id)
    setDeleting(false); setConfirmDeleteId(null); fetchData()
  }

  let filtered = credentials.filter(c => {
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.username || '').toLowerCase().includes(q) ||
      (c.url || '').toLowerCase().includes(q) || (c.notes || '').toLowerCase().includes(q) ||
      (c.clients?.name || '').toLowerCase().includes(q)
  })
  if (filterCategory !== 'all') filtered = filtered.filter(c => c.category_id === filterCategory)
  if (filterClient === 'internal') filtered = filtered.filter(c => !c.client_id)
  else if (filterClient !== 'all') filtered = filtered.filter(c => c.client_id === filterClient)

  const catCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat.id] = credentials.filter(c => c.category_id === cat.id).length; return acc
  }, {})

  const selectedCatName = filterCategory !== 'all' ? categories.find(c => c.id === filterCategory)?.name : null
  const selectedClientLabel = filterClient === 'all' ? null : filterClient === 'internal' ? 'Feel Pixel' : clients.find(c => c.id === filterClient)?.name || null

  // Checks de acceso — siempre después de todos los hooks
  if (loadingPerms) return null
  if (!can('boveda')) return <AccessDenied />
  return (
    <div className="min-h-screen" onClick={() => { setShowCatDropdown(false); setShowClientDropdown(false) }}>

      {/* Header */}
      <div className="sticky top-0 z-10 px-8 py-4 border-b border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-sidebar-dark">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-fp-navy dark:text-fp-honeydew tracking-tight flex items-center gap-2">
              <Lock size={18} className="text-fp-punch-red" />Bóveda
            </h1>
            <p className="text-xs text-gray-400 dark:text-fp-text-tertiary mt-0.5">
              {credentials.length} credencial{credentials.length !== 1 ? 'es' : ''} · Solo equipo interno
            </p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 transition-colors">
            <Plus size={15} /> Nueva Credencial
          </button>
        </div>
      </div>

      <div className="p-8 space-y-6">

        {/* Category cards */}
        {!loading && categories.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {categories.map(cat => {
              const Icon = getCategoryIcon(cat.icon)
              const color = getCategoryColor(cat.icon)
              const isActive = filterCategory === cat.id
              return (
                <button key={cat.id} onClick={e => { e.stopPropagation(); setFilterCategory(isActive ? 'all' : cat.id) }}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${isActive ? 'border-fp-cerulean bg-fp-cerulean/5' : 'border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark hover:border-fp-cerulean/30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}><Icon size={20} /></div>
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">{catCounts[cat.id] || 0} items</div>
                    <div className={`text-sm font-semibold truncate ${isActive ? 'text-fp-cerulean' : 'text-fp-navy dark:text-fp-honeydew'}`}>{cat.name}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Search + filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-card-dark flex-1 min-w-48">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input type="text" placeholder="Buscar credenciales, clientes..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew placeholder-gray-400 dark:placeholder-fp-text-tertiary w-full" />
          </div>
          {/* Cat filter */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowCatDropdown(!showCatDropdown); setShowClientDropdown(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${filterCategory !== 'all' ? 'border-fp-cerulean text-fp-cerulean bg-fp-cerulean/5' : 'border-gray-200 dark:border-fp-border-dark text-gray-500 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark'}`}>
              <Filter size={12} />{selectedCatName || 'Categoría'}
              {filterCategory !== 'all' ? <button onClick={e => { e.stopPropagation(); setFilterCategory('all') }}><X size={10} className="ml-0.5" /></button> : <ChevronDown size={10} />}
            </button>
            {showCatDropdown && (
              <div className="absolute right-0 top-9 w-52 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                <button onClick={() => { setFilterCategory('all'); setShowCatDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterCategory === 'all' ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>Todas las categorías</button>
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => { setFilterCategory(cat.id); setShowCatDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterCategory === cat.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>{cat.name}</button>
                ))}
              </div>
            )}
          </div>
          {/* Client filter */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowClientDropdown(!showClientDropdown); setShowCatDropdown(false) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${filterClient !== 'all' ? 'border-fp-cerulean text-fp-cerulean bg-fp-cerulean/5' : 'border-gray-200 dark:border-fp-border-dark text-gray-500 dark:text-fp-text-secondary bg-white dark:bg-fp-card-dark hover:bg-gray-50 dark:hover:bg-fp-hover-dark'}`}>
              <Building2 size={12} />{selectedClientLabel || 'Cliente'}
              {filterClient !== 'all' ? <button onClick={e => { e.stopPropagation(); setFilterClient('all') }}><X size={10} className="ml-0.5" /></button> : <ChevronDown size={10} />}
            </button>
            {showClientDropdown && (
              <div className="absolute right-0 top-9 w-52 bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                <button onClick={() => { setFilterClient('all'); setShowClientDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterClient === 'all' ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>Todos</button>
                <button onClick={() => { setFilterClient('internal'); setShowClientDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterClient === 'internal' ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>🏢 Feel Pixel (propia)</button>
                <div className="border-t border-gray-100 dark:border-fp-border-dark my-1" />
                {clients.map(c => (
                  <button key={c.id} onClick={() => { setFilterClient(c.id); setShowClientDropdown(false) }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-fp-hover-dark ${filterClient === c.id ? 'text-fp-cerulean font-semibold' : 'text-fp-navy dark:text-fp-honeydew'}`}>{c.name}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16"><p className="text-sm text-gray-400 dark:text-fp-text-tertiary">Cargando bóveda...</p></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-fp-card-dark border border-dashed border-gray-300 dark:border-fp-border-dark rounded-xl p-12 text-center">
            <Lock size={40} className="text-gray-300 dark:text-fp-text-tertiary mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-fp-navy dark:text-fp-honeydew mb-1">{search ? 'Sin resultados' : 'No hay credenciales todavía'}</h3>
            {!search && <p className="text-xs text-gray-400 dark:text-fp-text-tertiary">Agregá la primera con el botón "Nueva Credencial".</p>}
          </div>
        ) : (
          <div className="bg-white dark:bg-fp-card-dark border border-gray-200 dark:border-fp-border-dark rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[1fr_120px_120px_180px_170px_56px_110px_88px] gap-2 px-5 py-3 border-b border-gray-100 dark:border-fp-border-dark text-xs text-gray-400 uppercase tracking-wider font-medium min-w-[980px]">
                <span>Nombre</span><span>Cliente</span><span>Categoría</span>
                <span>Usuario</span><span>Contraseña</span>
                <span className="text-center">Google</span>
                <span>Actualización</span><span className="text-right">Acciones</span>
              </div>

              {filtered.map(cred => {
                const cat = cred.credential_categories
                const Icon = cat ? getCategoryIcon(cat.icon) : Lock
                const color = cat ? getCategoryColor(cat.icon) : 'text-fp-text-secondary bg-fp-text-secondary/10'
                const isRevealed = revealedIds.has(cred.id)
                return (
                  <div key={cred.id} className="grid grid-cols-[1fr_120px_120px_180px_170px_56px_110px_88px] gap-2 px-5 py-3 border-b border-gray-50 dark:border-fp-border-dark items-start hover:bg-gray-50 dark:hover:bg-fp-hover-dark transition-colors min-w-[980px]">

                    {/* Name + URL + Notes */}
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}><Icon size={13} /></div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-fp-navy dark:text-fp-honeydew truncate">{cred.name}</div>
                        {cred.url && (
                          <a href={cred.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-fp-cerulean flex items-center gap-0.5 truncate w-fit">
                            <Globe size={9} className="flex-shrink-0" />{cred.url.replace(/^https?:\/\//, '').split('/')[0]}
                          </a>
                        )}
                        {cred.notes && (
                          <p className="text-[10px] text-fp-text-secondary dark:text-fp-text-tertiary mt-0.5 line-clamp-2 leading-relaxed">
                            {cred.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Client */}
                    <span className="text-xs text-gray-500 dark:text-fp-text-secondary truncate pt-0.5">
                      {cred.clients?.name || <span className="italic text-fp-text-tertiary">Feel Pixel</span>}
                    </span>

                    {/* Category */}
                    <div className="pt-0.5">
                      {cat ? <span className={`text-xs px-2 py-0.5 rounded-md w-fit font-medium ${color}`}>{cat.name}</span> : <span className="text-xs text-gray-400">—</span>}
                    </div>

                    {/* Username */}
                    <div className="flex items-center gap-1 min-w-0 pt-0.5">
                      {cred.login_with_google ? (
                        <span className="text-xs text-gray-400 italic">— vía Google</span>
                      ) : cred.username ? (
                        <>
                          <span className="text-xs text-fp-navy dark:text-fp-honeydew truncate font-mono">{cred.username}</span>
                          <button onClick={() => copyText(cred.username!, `${cred.id}-user`)} title="Copiar usuario"
                            className={`p-1 rounded flex-shrink-0 transition-colors ${copiedField === `${cred.id}-user` ? 'text-emerald-400' : 'text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10'}`}>
                            {copiedField === `${cred.id}-user` ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </div>

                    {/* Password */}
                    <div className="flex items-center gap-1 pt-0.5">
                      {cred.login_with_google ? (
                        <span className="text-xs text-gray-400 italic">— vía Google</span>
                      ) : cred.password_encrypted ? (
                        <>
                          <span className="text-xs text-fp-navy dark:text-fp-honeydew font-mono">
                            {isRevealed ? cred.password_encrypted : '••••••••••••'}
                          </span>
                          <button onClick={() => toggleReveal(cred.id)} title={isRevealed ? 'Ocultar' : 'Mostrar'}
                            className="p-1 rounded flex-shrink-0 text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors">
                            {isRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                          </button>
                          <button onClick={() => copyText(cred.password_encrypted!, `${cred.id}-pass`)} title="Copiar contraseña"
                            className={`p-1 rounded flex-shrink-0 transition-colors ${copiedField === `${cred.id}-pass` ? 'text-emerald-400' : 'text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10'}`}>
                            {copiedField === `${cred.id}-pass` ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </div>

                    {/* Google badge */}
                    <div className="flex justify-center pt-1">
                      {cred.login_with_google && (
                        <span title="Login con Google" className="flex items-center justify-center w-6 h-6 rounded-full bg-white dark:bg-fp-bg-dark border border-gray-200 dark:border-fp-border-dark shadow-sm">
                          <GoogleBadge small />
                        </span>
                      )}
                    </div>

                    {/* Updated at */}
                    <span className="text-xs text-gray-400 dark:text-fp-text-tertiary pt-0.5">{formatDate(cred.updated_at)}</span>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 justify-end pt-0.5">
                      {!cred.login_with_google && cred.username && cred.password_encrypted && (
                        <button onClick={() => copyText(`Usuario: ${cred.username}\nContraseña: ${cred.password_encrypted}`, `${cred.id}-both`)} title="Copiar usuario y contraseña"
                          className={`p-1.5 rounded-lg transition-colors ${copiedField === `${cred.id}-both` ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10'}`}>
                          {copiedField === `${cred.id}-both` ? <Check size={12} /> : <KeyRound size={12} />}
                        </button>
                      )}
                      {cred.url && (
                        <button onClick={() => window.open(cred.url!, '_blank')} title="Abrir URL"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors">
                          <ExternalLink size={12} />
                        </button>
                      )}
                      <button onClick={() => openEdit(cred)} title="Editar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-fp-cerulean hover:bg-fp-cerulean/10 transition-colors">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(cred.id)} title="Eliminar"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-fp-punch-red hover:bg-fp-punch-red/10 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-5 py-3 text-xs text-gray-400 dark:text-fp-text-tertiary border-t border-gray-50 dark:border-fp-border-dark">
              Mostrando {filtered.length} de {credentials.length} credenciales
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white dark:bg-fp-card-dark rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-fp-border-dark">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-fp-punch-red/10 flex items-center justify-center flex-shrink-0">
                  <Lock size={16} className="text-fp-punch-red" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-fp-navy dark:text-fp-honeydew">{editingId ? 'Editar Credencial' : 'Nueva Credencial'}</h2>
                  <p className="text-xs text-gray-400">{editingId ? 'Modificá los datos de acceso' : 'Añade acceso seguro a la Bóveda'}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-fp-punch-red transition-colors"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name + client */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Nombre del Servicio *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ej. Vercel, Meta Ads"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean placeholder-gray-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Cliente</label>
                  <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean">
                    <option value="">Feel Pixel (propia)</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">URL de acceso</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark focus-within:border-fp-cerulean transition-colors">
                  <Globe size={13} className="text-gray-400 flex-shrink-0" />
                  <input type="text" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://app.vercel.com"
                    className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew w-full placeholder-gray-400" />
                </div>
              </div>

              {/* Login con Google toggle */}
              <div onClick={() => setForm(f => ({ ...f, login_with_google: !f.login_with_google }))}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${form.login_with_google ? 'border-blue-400 bg-blue-400/5' : 'border-gray-200 dark:border-fp-border-dark hover:border-blue-400/30'}`}>
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-fp-bg-dark border border-gray-200 dark:border-fp-border-dark flex items-center justify-center flex-shrink-0 shadow-sm">
                  <GoogleBadge />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${form.login_with_google ? 'text-blue-500' : 'text-fp-navy dark:text-fp-honeydew'}`}>Login con Google</div>
                  <div className="text-xs text-gray-400 dark:text-fp-text-tertiary">El acceso se hace con cuenta de Google, sin usuario ni contraseña</div>
                </div>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${form.login_with_google ? 'bg-blue-400 border-blue-400' : 'border-gray-300 dark:border-fp-border-dark'}`}>
                  {form.login_with_google && <Check size={12} className="text-white" />}
                </div>
              </div>

              {/* User + password — se ocultan si es login Google */}
              {!form.login_with_google && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Usuario o Email</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark focus-within:border-fp-cerulean transition-colors">
                      <User size={13} className="text-gray-400 flex-shrink-0" />
                      <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="dev@feelpixel.com"
                        className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew w-full placeholder-gray-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Contraseña</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark focus-within:border-fp-cerulean transition-colors">
                      <Lock size={13} className="text-gray-400 flex-shrink-0" />
                      <input type={showModalPass ? 'text' : 'password'} value={form.password_encrypted} onChange={e => setForm(f => ({ ...f, password_encrypted: e.target.value }))} placeholder="••••••••••••"
                        className="bg-transparent outline-none text-sm text-fp-navy dark:text-fp-honeydew w-full placeholder-gray-400" />
                      <button type="button" onClick={() => setShowModalPass(!showModalPass)} className="text-gray-400 hover:text-fp-cerulean flex-shrink-0 transition-colors">
                        {showModalPass ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Category chips */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-2 block">Categoría</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => {
                    const Icon = getCategoryIcon(cat.icon)
                    const isSelected = form.category_id === cat.id
                    return (
                      <button key={cat.id} type="button" onClick={() => setForm(f => ({ ...f, category_id: isSelected ? '' : cat.id }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${isSelected ? 'border-fp-cerulean bg-fp-cerulean/10 text-fp-cerulean' : 'border-gray-200 dark:border-fp-border-dark text-gray-500 dark:text-fp-text-secondary hover:border-fp-cerulean/40 hover:text-fp-navy dark:hover:text-fp-honeydew'}`}>
                        <Icon size={11} />{cat.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-500 dark:text-fp-text-secondary mb-1 block">Notas adicionales</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Añade detalles, tokens específicos, instrucciones de uso..." rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-fp-border-dark bg-white dark:bg-fp-bg-dark text-sm text-fp-navy dark:text-fp-honeydew outline-none focus:border-fp-cerulean resize-none placeholder-gray-400" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 pb-6">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-500 dark:text-fp-text-secondary hover:text-fp-navy dark:hover:text-fp-honeydew transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 disabled:opacity-50 transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {saving ? 'Guardando...' : 'Guardar Credencial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white dark:bg-fp-card-dark rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-fp-punch-red/10 flex items-center justify-center flex-shrink-0"><Trash2 size={18} className="text-fp-punch-red" /></div>
              <div>
                <h3 className="text-sm font-bold text-fp-navy dark:text-fp-honeydew">Eliminar credencial</h3>
                <p className="text-xs text-gray-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-fp-navy dark:hover:text-fp-honeydew transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(confirmDeleteId)} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fp-punch-red text-white text-sm font-semibold hover:bg-fp-punch-red/90 disabled:opacity-50 transition-colors">
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
