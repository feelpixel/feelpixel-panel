import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CLIENTES_ACTIVOS_ID = '1j_1NrXhwPTD-PCMArEuzBWroJmG27Y39'

async function createFolder(name: string, parentId: string, token: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Error creando carpeta "${name}": ${error}`)
  }

  const data = await response.json()
  return data.id
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return NextResponse.json({ error: 'No hay token de Google. Cerrá sesión y volvé a entrar.' }, { status: 401 })
  }

  const { clientId, clientName } = await request.json()

  if (!clientId || !clientName) {
    return NextResponse.json({ error: 'Faltan clientId o clientName' }, { status: 400 })
  }

  const token = session.provider_token

  try {
    // ── Carpeta raíz del cliente ──
    const clientRootId = await createFolder(clientName, CLIENTES_ACTIVOS_ID, token)

    // ── 00_Onboarding_Brand + subcarpetas ──
    const onboardingId = await createFolder('00_Onboarding_Brand', clientRootId, token)
    await createFolder('01_Gráfica oficial', onboardingId, token)
    await createFolder('02_Fuentes cliente', onboardingId, token)
    await createFolder('03_Manual de Marca', onboardingId, token)
    await createFolder('04_Material provisto por el cliente', onboardingId, token)

    // ── 01_Gestión ──
    await createFolder('01_Gestión', clientRootId, token)

    // ── 02_Fee_Mensual + carpeta del año actual ──
    const feeId = await createFolder('02_Fee_Mensual', clientRootId, token)
    const currentYear = new Date().getFullYear().toString()
    await createFolder(currentYear, feeId, token)

    // ── 03_Proyectos_Específicos ──
    const proyectosId = await createFolder('03_Proyectos_Específicos', clientRootId, token)

    // ── 04_Entregables_Finales ──
    await createFolder('04_Entregables_Finales', clientRootId, token)

    // ── 05_Recursos ──
    await createFolder('05_Recursos', clientRootId, token)

    // ── Guardar IDs en Supabase ──
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        drive_folder_id: proyectosId,
        drive_fee_folder_id: feeId,
      })
      .eq('id', clientId)

    if (updateError) {
      console.error('Error guardando IDs en Supabase:', updateError)
      return NextResponse.json({
        success: true,
        warning: 'Carpetas creadas en Drive, pero no se pudieron guardar los IDs en la base de datos.',
        clientRootId,
        proyectosId,
        feeId,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Estructura de cliente creada correctamente',
      clientRootId,
      proyectosId,
      feeId,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('Error en setup-client:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
