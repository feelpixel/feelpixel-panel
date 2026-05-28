import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function findFolder(name: string, parentId: string, token: string): Promise<string | null> {
  const query = encodeURIComponent(
    `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  )
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  const data = await response.json()
  return data.files?.[0]?.id || null
}

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

async function ensureFolder(name: string, parentId: string, token: string): Promise<string> {
  const existing = await findFolder(name, parentId, token)
  if (existing) return existing
  return createFolder(name, parentId, token)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.provider_token) {
    return NextResponse.json({ error: 'No hay token de Google' }, { status: 401 })
  }

  const { parentFolderId, pathSegments } = await request.json()

  if (!parentFolderId || !pathSegments || !Array.isArray(pathSegments) || pathSegments.length === 0) {
    return NextResponse.json({ error: 'Faltan parentFolderId o pathSegments' }, { status: 400 })
  }

  const token = session.provider_token

  try {
    let currentParentId = parentFolderId

    for (const segment of pathSegments) {
      currentParentId = await ensureFolder(segment, currentParentId, token)
    }

    return NextResponse.json({
      success: true,
      folderId: currentParentId,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
