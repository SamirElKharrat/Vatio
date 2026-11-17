import { HttpError } from '../http.js'
import { parseDisa } from './disa.js'
import { parseEndesa } from './endesa.js'
import { PdfPasswordError, PdfUnreadableError, readPdfRows } from './pdfText.js'
import { InvoiceFormatError } from './types.js'

const READERS = {
  endesa: { name: 'Endesa', marker: /Endesa Energía/i, parse: parseEndesa },
  disa: { name: 'DISA', marker: /Disa Energía/i, parse: parseDisa },
}

/** De qué comercializadora parece el PDF, por el nombre de la empresa que aparece en él */
function detectProvider(rows) {
  const text = rows.map((row) => row.text).join('\n')
  return (Object.keys(READERS)).find((provider) => READERS[provider].marker.test(text)) ?? null
}

/**
 * Lee una factura en PDF con el lector de la comercializadora elegida.
 * Los fallos se devuelven con una clave (`code`) para que la pantalla sepa qué pedir.
 */
export async function parseInvoicePdf(data, provider, password) {
  let rows
  try {
    rows = await readPdfRows(data, password)
  } catch (error) {
    if (error instanceof PdfPasswordError) {
      throw error.reason === 'needed'
        ? new HttpError(422, 'Este PDF está protegido. Escribe su contraseña para leerlo.', undefined, 'password_needed')
        : new HttpError(422, 'La contraseña del PDF no es correcta.', undefined, 'password_incorrect')
    }
    if (error instanceof PdfUnreadableError) {
      throw new HttpError(422, 'El archivo no es un PDF que se pueda leer.', undefined, 'not_a_pdf')
    }
    throw error
  }

  const detected = detectProvider(rows)
  if (detected && detected !== provider) {
    throw new HttpError(
      422,
      `Este PDF parece una factura de ${READERS[detected].name}, no de ${READERS[provider].name}. Cambia la comercializadora y vuelve a subirlo.`,
      undefined,
      `provider_is_${detected}`,
    )
  }

  try {
    return READERS[provider].parse(rows)
  } catch (error) {
    if (error instanceof InvoiceFormatError) {
      throw new HttpError(
        422,
        `Este PDF no tiene la forma de una factura de luz de ${READERS[provider].name}. ${error.message}. Puedes escribir los datos a mano.`,
        undefined,
        'unknown_format',
      )
    }
    throw error
  }
}
