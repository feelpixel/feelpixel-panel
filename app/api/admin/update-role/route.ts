import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Cliente con service role key — nunca se expone al browser
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, userId, email, fullName, role, permissions } = body

    // ── ACCIÓN: INVITAR usuario nuevo ──────────────────────────
    if (action === 'invite') {
      // 1. Crear usuario en Supabase Auth (manda email automático)
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { role }, // se guarda en raw_user_meta_data
        })

      if (inviteError) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 })
      }

      const newUserId = inviteData.user.id

      // 2. Actualizar app_metadata con el rol (para RLS)
      await supabaseAdmin.auth.admin.updateUserById(newUserId, {
        app_metadata: { role },
      })

      // 3. Crear/actualizar el perfil
      await supabaseAdmin.from('profiles').upsert({
        id: newUserId,
        email,
        full_name: fullName || '',
        role,
      })

      // 4. Guardar permisos si vienen
      if (permissions && permissions.length > 0) {
        const permRows = permissions.map((p: PermissionRow) => ({
          profile_id: newUserId,
          module: p.module,
          can_view: p.can_view,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
          can_export: p.can_export,
        }))
        await supabaseAdmin.from('user_permissions').upsert(permRows, {
          onConflict: 'profile_id,module',
        })
      }

      return NextResponse.json({ success: true, userId: newUserId })
    }

    // ── ACCIÓN: CAMBIAR ROL de usuario existente ───────────────
    if (action === 'update') {
      // 1. Actualizar app_metadata (para RLS)
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { role },
      })

      // 2. Actualizar profiles.role (para UI)
      await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', userId)

      // 3. Guardar permisos si vienen
      if (permissions && permissions.length > 0) {
        const permRows = permissions.map((p: PermissionRow) => ({
          profile_id: userId,
          module: p.module,
          can_view: p.can_view,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
          can_export: p.can_export,
        }))
        await supabaseAdmin.from('user_permissions').upsert(permRows, {
          onConflict: 'profile_id,module',
        })
      }

      return NextResponse.json({ success: true })
    }

    // ── ACCIÓN: ELIMINAR usuario ───────────────────────────────
    if (action === 'delete') {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (err) {
    console.error('Error en update-role:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Tipo auxiliar
interface PermissionRow {
  module: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
  can_export: boolean
}