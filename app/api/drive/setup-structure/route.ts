import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ROOT_FOLDER_ID = '1-gLSHcuhIENaomQyhLRY50mrPqbjfo-9'

async function createFolder(name: string, parentId: string, token: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
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
  const data = await response.json()
  return data.id
}

export async function POST() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return NextResponse.json({ error: 'No hay token de Google' }, { status: 401 })
  }

  const token = session.provider_token

  // Nivel raíz
  const inboxId = await createFolder('00_INBOX', ROOT_FOLDER_ID, token)
  const clientesId = await createFolder('01_CLIENTES_ACTIVOS', ROOT_FOLDER_ID, token)
  const labId = await createFolder('02_LAB_AUTOMATIZACIONES', ROOT_FOLDER_ID, token)
  const recursosId = await createFolder('03_RECURSOS_STUDIO', ROOT_FOLDER_ID, token)
  const internaId = await createFolder('04_AGENCIA_INTERNA', ROOT_FOLDER_ID, token)
  await createFolder('99_ARCHIVO_MUERTO', ROOT_FOLDER_ID, token)

  // Plantilla cliente
  const plantillaId = await createFolder('_PLANTILLA_CLIENTE_V1', clientesId, token)
  const onboardingId = await createFolder('00_Onboarding_Brand', plantillaId, token)
  await createFolder('Manual_Marca', onboardingId, token)
  await createFolder('Logos', onboardingId, token)
  await createFolder('Tipografías_Cliente', onboardingId, token)
  await createFolder('01_Recursos', plantillaId, token)
  const feeId = await createFolder('02_Fee_Mensual', plantillaId, token)
  await createFolder('Informes', feeId, token)
  await createFolder('Meetings', feeId, token)
  await createFolder('Publicaciones_Mensuales', feeId, token)
  await createFolder('03_Proyectos_Específicos', plantillaId, token)
  await createFolder('04_Entregables_Finales', plantillaId, token)

  // Recursos Studio
  await createFolder('01_Brand_FeelPixel', recursosId, token)
  await createFolder('02_Bancos_Imagen_Video', recursosId, token)
  await createFolder('03_Música_SFX', recursosId, token)
  await createFolder('04_Recursos_Video', recursosId, token)
  await createFolder('05_Extras', recursosId, token)
  await createFolder('06_Renders_Finales', recursosId, token)
  await createFolder('07_Softwares', recursosId, token)

  // Agencia Interna
  await createFolder('00_Seguridad', internaId, token)
  await createFolder('01_Legal', internaId, token)
  await createFolder('02_Finanzas', internaId, token)
  await createFolder('03_RRHH', internaId, token)

  return NextResponse.json({ success: true, message: 'Estructura creada correctamente' })
}