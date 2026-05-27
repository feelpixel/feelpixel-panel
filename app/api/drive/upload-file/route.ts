import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const parentFolderId = formData.get('parentFolderId') as string
  const providerToken = formData.get('providerToken') as string

  if (!providerToken) {
    return NextResponse.json(
      { error: 'No hay token de Google. Cerrá sesión y volvé a entrar.' },
      { status: 401 }
    )
  }

  if (!file) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  }

  if (!parentFolderId) {
    return NextResponse.json({ error: 'No se especificó carpeta destino en Drive' }, { status: 400 })
  }

  // Construir multipart/related manualmente — requerido por la Drive Upload API
  const boundary = '-------feelpixelpanel314159265'
  const metadata = JSON.stringify({ name: file.name, parents: [parentFolderId] })
  const mimeType = file.type || 'application/octet-stream'
  const fileBuffer = await file.arrayBuffer()

  const headerText = [
    `--${boundary}\r\n`,
    `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
    `${metadata}\r\n`,
    `--${boundary}\r\n`,
    `Content-Type: ${mimeType}\r\n\r\n`,
  ].join('')

  const footerText = `\r\n--${boundary}--`

  const headerBytes = new TextEncoder().encode(headerText)
  const footerBytes = new TextEncoder().encode(footerText)
  const fileBytes = new Uint8Array(fileBuffer)

  const body = new Uint8Array(headerBytes.length + fileBytes.length + footerBytes.length)
  body.set(headerBytes, 0)
  body.set(fileBytes, headerBytes.length)
  body.set(footerBytes, headerBytes.length + fileBytes.length)

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Drive upload error:', data)
    return NextResponse.json(
      { error: data.error?.message || 'Error al subir a Drive' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    fileId: data.id,
    fileName: data.name,
    webViewLink: data.webViewLink,
    webContentLink: data.webContentLink,
    size: parseInt(data.size || '0', 10),
  })
}
