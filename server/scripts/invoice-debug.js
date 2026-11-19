// Diagnóstico de una factura que no se lee bien: enseña los renglones tal como los ve el lector
// (página, altura y posición de cada trozo) y después lo que el lector saca de ellos, o su error.
//
//   npm run invoice:debug -w server -- ruta/factura.pdf endesa
//   npm run invoice:debug -w server -- ruta/factura.pdf disa
//
// Si el PDF está protegido, la contraseña (en DISA, el DNI del titular) se escribe cuando la pide,
// sin que se vea en pantalla. No se acepta como argumento para que no quede en el historial.
// La salida lleva datos personales de la factura: no la copies tal cual al repositorio.

import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { readPdfRows, PdfPasswordError } from '../src/invoices/pdfText.js'
import { parseDisa } from '../src/invoices/disa.js'
import { parseEndesa } from '../src/invoices/endesa.js'

const PARSERS = { endesa: parseEndesa, disa: parseDisa }
const [file, provider] = process.argv.slice(2)

if (!file || !PARSERS[provider]) {
  console.error('Uso: npm run invoice:debug -w server -- <factura.pdf> <endesa|disa>')
  process.exit(1)
}

/** Pide la contraseña por la consola sin mostrar lo que se escribe */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) process.stdout.write(question)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

const data = new Uint8Array(readFileSync(file))
let rows
try {
  rows = await readPdfRows(data.slice())
} catch (error) {
  if (!(error instanceof PdfPasswordError)) throw error
  const label = provider === 'disa' ? 'DNI del titular' : 'Contraseña del PDF'
  rows = await readPdfRows(data.slice(), await askHidden(`${label}: `))
}

console.log(`\n${rows.length} renglones\n`)
for (const row of rows) {
  const items = row.items.map((item) => `[${Math.round(item.x)}] ${item.text}`).join('  ')
  console.log(`p${row.page} y=${Math.round(row.y)}  ${items}`)
}

console.log(`\nLector de ${provider}:\n`)
try {
  console.dir(PARSERS[provider](rows), { depth: null })
} catch (error) {
  console.log(`Error: ${error.message}`)
  process.exitCode = 1
}
