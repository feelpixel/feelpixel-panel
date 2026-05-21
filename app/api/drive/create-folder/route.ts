import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { folderName, parentId, providerToken } = await request.json()

  if (!providerToken) {
    return NextResponse.json({ error: 'No hay token de Google. Cerrá sesión y volvé a entrar.' }, { status: 401 })
  }

  // supportsAllDrives=true es necesario para Unidades Compartidas
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${providerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  )

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message || 'Error en Drive' }, { status: 500 })
  }

  return NextResponse.json({
    folderId: data.id,
    folderUrl: `https://drive.google.com/drive/folders/${data.id}`,
  })
}