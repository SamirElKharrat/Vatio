import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

/** El PDF pide contraseña, o la que se ha dado no vale */
export class PdfPasswordError extends Error {
  reason

  constructor(reason) {
    super(reason === 'needed' ? 'El PDF está protegido con contraseña' : 'La contraseña del PDF no es correcta')
    this.reason = reason
  }
}

/** El archivo no es un PDF que se pueda leer */
export class PdfUnreadableError extends Error {}

// Dos trozos están en el mismo renglón si su altura difiere como mucho esto
const ROW_TOLERANCE = 2

/**
 * Extrae el texto de un PDF agrupado por renglones. Se conserva la posición de cada trozo porque
 * hay facturas donde el concepto y su importe sólo se pueden emparejar por estar a la misma altura.
 */
export async function readPdfRows(data, password) {
  const task = getDocument({ data, password: password || undefined, verbosity: 0, useSystemFonts: false })
  let doc
  try {
    doc = await task.promise
  } catch (error) {
    await task.destroy()
    const name = (error).name
    if (name === 'PasswordException') {
      // Código 1: hace falta contraseña. Código 2: la que se ha dado es incorrecta.
      throw new PdfPasswordError((error).code === 2 ? 'incorrect' : 'needed')
    }
    throw new PdfUnreadableError('No se puede leer el archivo como PDF')
  }

  const rows = []
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageRows = []
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const y = item.transform[5]
        let row = pageRows.find((candidate) => Math.abs(candidate.y - y) <= ROW_TOLERANCE)
        if (!row) {
          row = { page: pageNumber, y, items: [], text: '' }
          pageRows.push(row)
        }
        row.items.push({ x: item.transform[4], text: item.str.trim() })
      }
      for (const row of pageRows) {
        row.items.sort((a, b) => a.x - b.x)
        row.text = row.items.map((item) => item.text).join(' ')
      }
      pageRows.sort((a, b) => b.y - a.y)
      rows.push(...pageRows)
    }
  } finally {
    await task.destroy()
  }
  return rows
}
