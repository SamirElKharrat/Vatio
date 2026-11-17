import { findRow, findRows, isoDate, num, requireAmount, requireRow, round2, round6, rowAmount, sameCents } from './helpers.js'
import { InvoiceFormatError } from './types.js'

const N = '([\\d.]*\\d,\\d+)'
const BAND_OF = { P1: 'punta', P2: 'llano', P3: 'valle' }

/**
 * Lector de facturas de luz de DISA Energía Eléctrica. Cada concepto y su importe se emparejan
 * por estar en el mismo renglón; el orden de lectura del PDF no sirve porque va por columnas.
 */
export function parseDisa(rows) {
  const warnings = []
  const lines = []

  // Periodo: «Periodo consumo: de 28/08/2026» y, en el renglón de abajo, «a 19/09/2026»
  const periodStart = requireRow(rows, /Periodo consumo:.*?(\d\d\/\d\d\/\d{4})/, 'el periodo de consumo')
  const startIndex = rows.indexOf(periodStart.row)
  const periodEnd = findRow(rows.slice(startIndex + 1, startIndex + 6), /(?:^| )a (\d\d\/\d\d\/\d{4})/)
  if (!periodEnd) throw new InvoiceFormatError('el final del periodo de consumo')

  // Potencia
  const powerRows = findRows(rows, new RegExp(`^(P\\d) ${N} kW x (\\d+) Días x ${N} €/kW día`))
  if (powerRows.length === 0) throw new InvoiceFormatError('el término de potencia')
  const days = Number(powerRows[0].match[3])
  const power = { puntaLlano: { kw: 0, pricePerKwDay: 0 }, valle: { kw: 0, pricePerKwDay: 0 } }
  for (const { row, match } of powerRows) {
    power[match[1] === 'P1' ? 'puntaLlano' : 'valle'] = { kw: num(match[2]), pricePerKwDay: num(match[4]) }
    lines.push({ kind: 'power', label: `Potencia ${match[1]}`, amount: requireAmount(row, 'el importe de la potencia'), taxPct: null })
  }
  const powerTotal = round2(lines.reduce((total, line) => total + line.amount, 0))

  // Energía, una línea por tramo
  const energyRows = findRows(rows, new RegExp(`^(P\\d) ${N} kWh x ${N} €/kWh`))
  if (energyRows.length === 0) throw new InvoiceFormatError('el término de energía')
  const kwhByBand = { punta: 0, llano: 0, valle: 0 }
  const prices = { punta: 0, llano: 0, valle: 0 }
  let energyTotal = 0
  for (const { row, match } of energyRows) {
    const band = BAND_OF[match[1]]
    if (!band) continue
    const amount = requireAmount(row, 'el importe de la energía')
    kwhByBand[band] = num(match[2])
    prices[band] = num(match[3])
    energyTotal += amount
    lines.push({ kind: 'energy', label: `Energía ${match[1]}`, amount, taxPct: null })
  }
  energyTotal = round2(energyTotal)
  const samePrice = prices.punta === prices.llano && prices.llano === prices.valle

  // IGIC: «Impuesto IGIC DOMÉSTICOS 2020 (7,0 % ) al 9,65»
  const vatRows = findRows(rows, new RegExp(`^Impuesto (IGIC|IVA).*?\\((\\d+(?:,\\d+)?) ?% ?\\) al ${N}`)).map(({ row, match }) => ({
    label: `${match[1]} ${String(num(match[2])).replace('.', ',')} %`,
    pct: num(match[2]),
    base: num(match[3]),
    amount: rowAmount(row) ?? 0,
  }))

  // Impuesto eléctrico: «5,11269632 % sobre 21,52 € x 1»
  const tax = requireRow(rows, new RegExp(`^${N} % sobre ${N} €`), 'el impuesto de electricidad')
  const electricityTaxPct = num(tax.match[1])
  const electricityTaxBase = num(tax.match[2])
  const electricityTax = requireAmount(tax.row, 'el importe del impuesto de electricidad')

  // «Productos»: descuentos, bono social y cargos sueltos, entre ese título y el del impuesto eléctrico
  const productsStart = rows.findIndex((row) => row.text === 'Productos' && row.page === tax.row.page)
  const productsEnd = rows.findIndex((row) => /^Impuesto Electricidad$/i.test(row.text))
  const products = productsStart >= 0 && productsEnd > productsStart ? rows.slice(productsStart + 1, productsEnd) : []
  const discounts = []
  const dailyFees = []
  let discountTotal = 0
  const oneOffs = []
  let social = 0
  for (const row of products) {
    const amount = rowAmount(row)
    if (amount === null) continue
    const label = row.items[0].text
    if (/descuento/i.test(label) || amount < 0) {
      discounts.push({ label, type: 'amount', amount: Math.abs(amount) })
      discountTotal += Math.abs(amount)
      lines.push({ kind: 'discount', label, amount: -Math.abs(amount), taxPct: null })
    } else if (/bono social/i.test(label)) {
      social = amount
    } else {
      oneOffs.push({ kind: 'oneoff', label, amount, taxPct: null })
    }
  }

  // Alquiler del equipo de medida
  const rental = findRows(rows, /^Alquiler Equipo/).map(({ row }) => rowAmount(row)).find((amount) => amount !== null) ?? null

  // Qué impuesto lleva cada cosa: el suministro va en una base y el alquiler y los cargos sueltos en otra
  const supplyBase = round2(powerTotal + energyTotal - discountTotal + social + electricityTax)
  const supplyTaxPct = vatRows.find((row) => sameCents(row.base, supplyBase))?.pct ?? [...vatRows].sort((a, b) => b.base - a.base)[0]?.pct ?? 0
  const extras = round2((rental ?? 0) + oneOffs.reduce((total, line) => total + line.amount, 0))
  const extrasTaxPct = vatRows.find((row) => sameCents(row.base, extras))?.pct ?? null
  if (extras > 0 && extrasTaxPct === null) {
    warnings.push('No se ha podido saber qué impuesto llevan el alquiler del contador y los cargos sueltos.')
  }

  if (social > 0) {
    const inBase = sameCents(electricityTaxBase, powerTotal + energyTotal - discountTotal + social)
    dailyFees.push({ label: 'Bono social', pricePerDay: round6(social / days), inElectricityTaxBase: inBase, taxPct: supplyTaxPct })
    lines.push({ kind: 'fee', label: 'Bono social', amount: social, taxPct: supplyTaxPct })
  }
  if (rental !== null) {
    dailyFees.push({ label: 'Alquiler del contador', pricePerDay: round6(rental / days), inElectricityTaxBase: false, taxPct: extrasTaxPct ?? 0 })
    lines.push({ kind: 'fee', label: 'Alquiler del contador', amount: rental, taxPct: extrasTaxPct })
  }
  oneOffs.forEach((line) => lines.push({ ...line, taxPct: extrasTaxPct }))
  if (oneOffs.length) {
    warnings.push(`Esta factura lleva cargos que no se repiten: ${oneOffs.map((line) => line.label).join(', ')}. No se añaden al contrato.`)
  }

  lines.push({ kind: 'electricityTax', label: 'Impuesto electricidad', amount: electricityTax, taxPct: null })
  vatRows.forEach((row) => lines.push({ kind: 'tax', label: row.label, amount: row.amount, taxPct: row.pct }))

  const totalRow = findRows(rows, /^Total importe factura/).find(({ row }) => rowAmount(row) !== null)
  if (!totalRow) throw new InvoiceFormatError('el total de la factura')

  const fixedPrice = prices.punta || prices.llano || prices.valle
  return {
    provider: 'disa',
    from: isoDate(periodStart.match[1]),
    to: isoDate(periodEnd.match[1]),
    days,
    total: rowAmount(totalRow.row),
    kwh: Math.round((kwhByBand.punta + kwhByBand.llano + kwhByBand.valle) * 1000) / 1000,
    kwhByBand,
    lines,
    contract: {
      provider: 'disa',
      mode: samePrice ? 'fija' : 'tramos',
      fixedPrice,
      prices,
      power,
      discounts,
      dailyFees,
      electricityTaxPct,
      supplyTaxPct,
    },
    warnings,
  }
}
