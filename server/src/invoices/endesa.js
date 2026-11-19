import { findRow, findRows, isoDate, num, requireAmount, requireRow, round2, round6, rowAmount, sameCents } from './helpers.js'
import { InvoiceFormatError } from './types.js'

const N = '([\\d.]*\\d,\\d+)'

/** Lector de facturas de luz de Endesa Energía (mercado libre) */
export function parseEndesa(rows) {
  const warnings = []
  const lines = []

  const period = requireRow(
    rows,
    /Periodo de facturación: del (\d\d\/\d\d\/\d{4}) a (\d\d\/\d\d\/\d{4}) \((\d+) días?\)/,
    'el periodo de facturación',
  ).match
  const days = Number(period[3])

  // Potencia: una línea por periodo, con la operación completa
  const powerRows = findRows(rows, new RegExp(`^Pot\\. (.+?) ${N} kW x ${N} Eur/kW x (\\d+) días`))
  const power = { puntaLlano: { kw: 0, pricePerKwDay: 0 }, valle: { kw: 0, pricePerKwDay: 0 } }
  for (const { row, match } of powerRows) {
    const term = /valle|P3|P2/i.test(match[1]) ? 'valle' : 'puntaLlano'
    power[term] = { kw: num(match[2]), pricePerKwDay: num(match[3]) }
    lines.push({ kind: 'power', label: `Potencia ${match[1]}`, amount: requireAmount(row, 'el importe de la potencia'), taxPct: null })
  }
  if (powerRows.length === 0) throw new InvoiceFormatError('el término de potencia')

  // Energía: puede venir partida en varias líneas con el mismo precio. Según el mes, la línea empieza por
  // «Facturación del Consumo» o sólo por «Consumo»; «Consumo Total … kWh» no encaja porque no lleva « x … Eur/kWh».
  const energyRows = findRows(rows, new RegExp(`^(?:Facturación del )?Consumo ${N} kWh x ${N} Eur/kWh`))
  if (energyRows.length === 0) throw new InvoiceFormatError('la facturación del consumo')
  const energyAmounts = energyRows.map(({ row }) => requireAmount(row, 'el importe de la energía'))
  const energyPrices = energyRows.map(({ match }) => num(match[2]))
  const energyKwh = energyRows.map(({ match }) => num(match[1]))
  const billedKwh = energyKwh.reduce((a, b) => a + b, 0)
  energyRows.forEach((_, i) => lines.push({ kind: 'energy', label: 'Facturación del consumo', amount: energyAmounts[i], taxPct: null }))
  const energyTotal = round2(energyAmounts.reduce((a, b) => a + b, 0))
  // Si el precio cambia a mitad de periodo, cada tramo de días trae el suyo: se usa la media
  // ponderada por los kWh de cada uno, que es lo que ha salido el kWh en esta factura
  let fixedPrice = energyPrices[0]
  if (energyPrices.some((price) => price !== fixedPrice)) {
    fixedPrice = round6(energyPrices.reduce((total, price, i) => total + price * energyKwh[i], 0) / billedKwh)
    warnings.push('La factura trae varios precios de energía; se ha usado el precio medio. Revisa el precio en el contrato.')
  }

  // Descuentos. Se guardan en porcentaje sólo si se aplican a toda la energía; si no, en euros,
  // porque un porcentaje sobre todo el consumo daría otro importe.
  const discounts = []
  for (const { row, match } of findRows(rows, new RegExp(`^(Descuento .+?) ${N} Eur x -?\\s?(\\d+(?:,\\d+)?) ?%`))) {
    const amount = Math.abs(requireAmount(row, 'el importe de un descuento'))
    const label = match[1].trim()
    const pct = num(match[3])
    lines.push({ kind: 'discount', label, amount: -amount, taxPct: null })
    discounts.push(sameCents(num(match[2]), energyTotal) ? { label, type: 'percent', pct } : { label: `${label} (${String(pct).replace('.', ',')} % de parte del consumo)`, type: 'amount', amount })
  }
  const discountTotal = round2(lines.filter((line) => line.kind === 'discount').reduce((total, line) => total - line.amount, 0))

  // Impuesto eléctrico
  const tax = requireRow(rows, new RegExp(`^Impuesto electricidad \\( ?${N} Eur X ${N} ?%\\)`), 'el impuesto de electricidad')
  const electricityTaxBase = num(tax.match[1])
  const electricityTaxPct = num(tax.match[2])
  const electricityTax = requireAmount(tax.row, 'el importe del impuesto de electricidad')

  // IGIC o IVA: cada línea dice su tipo y sobre qué importe se aplica
  const vatRows = findRows(rows, new RegExp(`^(IGIC|IVA)\\b.*? (\\d+(?:,\\d+)?) ?% s/ ${N}`)).map(({ row, match }) => ({
    label: `${match[1]} ${match[2]} %`,
    pct: num(match[2]),
    base: num(match[3]),
    amount: rowAmount(row) ?? 0,
  }))
  const supplyBase = round2(powerTotal(lines) + energyTotal - discountTotal + electricityTax)
  const supplyTaxPct = vatRows.find((row) => sameCents(row.base, supplyBase))?.pct ?? [...vatRows].sort((a, b) => b.base - a.base)[0]?.pct ?? 0
  const taxOf = (amount) => vatRows.find((row) => sameCents(row.base, amount))?.pct ?? null

  // Cargos por día: bono social y alquiler del contador
  const dailyFees = []
  const social = findRow(rows, new RegExp(`^Financiación Bono Social (\\d+) días x ${N} Eur/día`))
  let socialAmount = 0
  if (social) {
    socialAmount = requireAmount(social.row, 'el importe del bono social')
    const inBase = sameCents(electricityTaxBase, powerTotal(lines) + energyTotal - discountTotal + socialAmount)
    const taxPct = taxOf(socialAmount) ?? 0
    dailyFees.push({ label: 'Financiación bono social', pricePerDay: num(social.match[2]), inElectricityTaxBase: inBase, taxPct })
    lines.push({ kind: 'fee', label: 'Financiación bono social', amount: socialAmount, taxPct })
  }
  const rentalRows = findRows(rows, new RegExp(`^Alquiler del contador \\( ?(\\d+) días x ${N} Eur/día`))
  if (rentalRows.length) {
    const amounts = rentalRows.map(({ row }) => requireAmount(row, 'el importe del alquiler del contador'))
    const rentalTotal = round2(amounts.reduce((a, b) => a + b, 0))
    const taxPct = taxOf(rentalTotal)
    if (taxPct === null) warnings.push('No se ha podido saber qué impuesto lleva el alquiler del contador.')
    dailyFees.push({ label: 'Alquiler del contador', pricePerDay: num(rentalRows[0].match[2]), inElectricityTaxBase: false, taxPct: taxPct ?? 0 })
    amounts.forEach((amount) => lines.push({ kind: 'fee', label: 'Alquiler del contador', amount, taxPct }))
  }

  lines.push({ kind: 'electricityTax', label: 'Impuesto electricidad', amount: electricityTax, taxPct: null })
  vatRows.forEach((row) => lines.push({ kind: 'tax', label: row.label, amount: row.amount, taxPct: row.pct }))

  const total = requireAmount(requireRow(rows, /^TOTAL(?! A PAGAR)\b/, 'el total de la factura').row, 'el total de la factura')
  for (const { row, match } of findRows(rows, /^(PARA TI)\b/)) {
    const amount = rowAmount(row)
    if (amount !== null && !lines.some((line) => line.kind === 'adjustment')) {
      lines.push({ kind: 'adjustment', label: match[1], amount, taxPct: null })
    }
  }

  // Lecturas del contador: una fila por tramo, con el consumo en la última columna
  const readings = {}
  for (const [band, name] of [['punta', 'Punta'], ['llano', 'Llano'], ['valle', 'Valle']]) {
    const reading = findRow(rows, new RegExp(`(?:^| )${name} [\\d.]+,\\d{3} [\\d.]+,\\d{3} .*?${N}$`))
    if (reading) readings[band] = num(reading.match[1])
  }
  const kwhByBand =
    readings.punta !== undefined && readings.llano !== undefined && readings.valle !== undefined
      ? { punta: readings.punta, llano: readings.llano, valle: readings.valle }
      : null
  if (!kwhByBand) warnings.push('No se han encontrado las lecturas por tramo.')

  const totalKwhRow = findRow(rows, new RegExp(`Consumo Total ${N} kWh`))

  return {
    provider: 'endesa',
    from: isoDate(period[1]),
    to: isoDate(period[2]),
    days,
    total,
    kwh: totalKwhRow ? num(totalKwhRow.match[1]) : Math.round(billedKwh * 1000) / 1000,
    kwhByBand,
    lines,
    contract: {
      provider: 'endesa',
      mode: 'fija',
      fixedPrice,
      prices: { punta: fixedPrice, llano: fixedPrice, valle: fixedPrice },
      power,
      discounts,
      dailyFees,
      electricityTaxPct,
      supplyTaxPct,
    },
    warnings,
  }
}

const powerTotal = (lines) =>
  lines.filter((line) => line.kind === 'power').reduce((total, line) => total + line.amount, 0)
