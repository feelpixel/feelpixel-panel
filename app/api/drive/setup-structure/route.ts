import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ROOT_FOLDER_ID = '1-gLSHcuhIENaomQyhLRY50mrPqbjfo-9'

async function createFolder(name: string, parentId: string, token: string) {
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

  const folders = [
    '00_INBOX',
    '01_CLIENTES_ACTIVOS',
    '02_LAB_AUTOMATIZACIONES',
    '03_RECURSOS_STUDIO',
    '04_AGENCIA_INTERNA',
    '99_ARCHIVO_MUERTO',
  ]

  const created: Record<string, string> = {}

  for (const folder of folders) {
    const id = await createFolder(folder, ROOT_FOLDER_ID, token)
    created[folder] = id
  }

  return NextResponse.json({ success: true, folders: created })
}