import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  const { fileId, providerToken } = await request.json()

  if (!providerToken) {
    return NextResponse.json(
      { error: 'No hay token de Google. Cerrá sesión y volvé a entrar.' },
      { status: 401 }
    )
  }

  if (!fileId) {
    return NextResponse.json({ error: 'No se especificó fileId' }, { status: 400 })
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${providerToken}`,
      },
    }
  )

  // 204 = borrado OK (sin body), cualquier otro 2xx también es ok
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}))
    console.error('Drive delete error:', data)
    return NextResponse.json(
      { error: data.error?.message || 'Error al eliminar en Drive' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
