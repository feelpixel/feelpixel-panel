import { NextRequest, NextResponse } from 'next/server'

// GET /api/drive/get-onboarding-folders?folderId=XXX&providerToken=YYY
//
// Dado el ID de la carpeta 03_Proyectos_Específicos del cliente,
// navega al padre (raíz del cliente), busca 00_Onboarding_Brand,
// y devuelve sus subcarpetas con URLs para el tab Branding.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const folderId = searchParams.get('folderId')
  const providerToken = searchParams.get('providerToken')

  if (!folderId || !providerToken) {
    return NextResponse.json({ error: 'folderId y providerToken son requeridos' }, { status: 400 })
  }

  const headers = { Authorization: `Bearer ${providerToken}` }

  try {
    // 1. Obtener el padre de 03_Proyectos_Específicos → esa es la raíz del cliente
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=parents&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers }
    )
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'No se pudo obtener el padre del folder' }, { status: 500 })
    }
    const fileData = await fileRes.json()
    const clientRootId = fileData.parents?.[0]
    if (!clientRootId) {
      return NextResponse.json({ error: 'No se encontró la carpeta raíz del cliente' }, { status: 404 })
    }

    // 2. Buscar 00_Onboarding_Brand dentro de la raíz del cliente
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${clientRootId}' in parents and mimeType='application/vnd.google-apps.folder' and name contains '00_Onboarding'`)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers }
    )
    if (!searchRes.ok) {
      return NextResponse.json({ error: 'No se pudo buscar la carpeta Onboarding' }, { status: 500 })
    }
    const searchData = await searchRes.json()
    const onboardingFolder = searchData.files?.[0]
    if (!onboardingFolder) {
      // No encontrada — devolvemos los labels sin URL
      return NextResponse.json({
        folders: [
          { label: 'Gráfica oficial',      url: null, id: null },
          { label: 'Fuentes cliente',       url: null, id: null },
          { label: 'Manual de Marca',       url: null, id: null },
          { label: 'Material del cliente',  url: null, id: null },
        ]
      })
    }

    // 3. Listar subcarpetas de 00_Onboarding_Brand
    const subRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${onboardingFolder.id}' in parents and mimeType='application/vnd.google-apps.folder'`)}&fields=files(id,name,webViewLink)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers }
    )
    if (!subRes.ok) {
      return NextResponse.json({ error: 'No se pudo listar subcarpetas' }, { status: 500 })
    }
    const subData = await subRes.json()
    const subFolders: { id: string; name: string; webViewLink: string }[] = subData.files || []

    // 4. Mapear a los labels conocidos (por nombre de carpeta)
    const labelMap: Record<string, string> = {
      '01_Gráfica oficial':              'Gráfica oficial',
      '01_Grafica oficial':              'Gráfica oficial',
      '02_Fuentes cliente':              'Fuentes cliente',
      '03_Manual de Marca':              'Manual de Marca',
      '04_Material provisto por el cliente': 'Material del cliente',
      '04_Material provisto':            'Material del cliente',
    }

    const defaultLabels = ['Gráfica oficial', 'Fuentes cliente', 'Manual de Marca', 'Material del cliente']
    const result = defaultLabels.map(label => {
      const found = subFolders.find(f => {
        const mapped = labelMap[f.name] || f.name
        return mapped === label || f.name.includes(label.split(' ')[0])
      })
      return {
        label,
        url: found?.webViewLink || null,
        id: found?.id || null,
      }
    })

    return NextResponse.json({ folders: result })
  } catch (err) {
    console.error('get-onboarding-folders error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
