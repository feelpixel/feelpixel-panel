import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.provider_token) {
    return NextResponse.json({ error: 'No hay token de Google' }, { status: 401 })
  }

  const { folderName, parentId } = await request.json()

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.provider_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message || 'Error en Drive' }, { status: 500 })
  }

  return NextResponse.json({ folderId: data.id, folderUrl: `https://drive.google.com/drive/folders/${data.id}` })
}