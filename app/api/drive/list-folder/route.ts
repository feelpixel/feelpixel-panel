import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return NextResponse.json({ error: 'No hay token de Google' }, { status: 401 })
  }

  const folderId = request.nextUrl.searchParams.get('folderId')
  if (!folderId) {
    return NextResponse.json({ error: 'Falta folderId' }, { status: 400 })
  }

  const token = session.provider_token

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `Error listando carpeta: ${error}` }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json({ folders: data.files || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
