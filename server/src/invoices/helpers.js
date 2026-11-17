import { InvoiceFormatError } from './types.js'

/** Cifra escrita a la española: «1.234,56» → 1234.56 */
export function num(text) {
  return parseFloat(text.replace(/\./g, '').replace(',', '.'))
}

/** «04/08/2026» → «2026-08-04» */
export function isoDate(text) {
  const [day, month, year] = text.split('/')
  return `${year}-${month}-${day}`
}

export const round2 = (value) => Math.round(value * 100 + 1e-7) / 100
export const round6 = (value) => Math.round(value * 1e6) / 1e6

const AMOUNT = /^(-?\s?[\d.]*\d,\d{2})\s*€$/
const EMPTY_AMOUNT = /^-\s*€?$/

/**
 * Importe en euros de un renglón: el trozo con forma «12,34 €» más a la derecha.
 * Un guion solo («- €») es un cero. Devuelve `null` si el renglón no trae importe.
 */
export function rowAmount(row) {
  for (let i = row.items.length - 1; i >= 0; i--) {
    const text = row.items[i].text
    const match = AMOUNT.exec(text)
    if (match) return num(match[1].replace(/\s/g, ''))
    if (text === '€' && i > 0 && row.items[i - 1].text === '-') return 0
    if (EMPTY_AMOUNT.test(text) && text.includes('€')) return 0
  }
  return null
}

/** Primer renglón cuyo texto encaja con el patrón */
export function findRow(rows, pattern) {
  for (const row of rows) {
    const match = pattern.exec(row.text)
    if (match) return { row, match }
  }
  return null
}

/** Todos los renglones cuyo texto encaja con el patrón */
export function findRows(rows, pattern) {
  return rows.flatMap((row) => {
    const match = pattern.exec(row.text)
    return match ? [{ row, match }] : []
  })
}

/** Como `findRow`, pero la factura no vale si falta */
export function requireRow(rows, pattern, what) {
  const found = findRow(rows, pattern)
  if (!found) throw new InvoiceFormatError(what)
  return found
}

export function requireAmount(row, what) {
  const amount = rowAmount(row)
  if (amount === null) throw new InvoiceFormatError(what)
  return amount
}

/** ¿Coinciden dos importes al céntimo? */
export const sameCents = (a, b) => Math.abs(a - b) < 0.005
