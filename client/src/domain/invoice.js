import { roundCents, sum } from './money'

/** Importe de un cargo diario, redondeado como línea de factura */
export const dailyAmount = (days, pricePerDay) => roundCents(days * pricePerDay)

/**
 * Calcula una factura como lo hace la comercializadora: cada línea se redondea
 * a céntimos por separado y los impuestos se calculan sobre las sumas ya redondeadas.
 */
export function computeInvoice(input) {
  const powerLines = input.power.map((line) => roundCents(line.kw * line.pricePerKwDay * line.days))
  const energyLines = input.energy.map((line) => roundCents(line.kwh * line.price))
  const power = roundCents(sum(powerLines))
  const energy = roundCents(sum(energyLines))

  const discountLines = input.discounts.map((discount) => {
    if (discount.type === 'amount') return roundCents(discount.amount)
    const base = discount.onEnergyLines ? sum(discount.onEnergyLines.map((i) => energyLines[i] ?? 0)) : energy
    return roundCents((base * discount.pct) / 100)
  })
  const discounts = roundCents(sum(discountLines))

  const feeLines = input.fees.map((fee) => roundCents(fee.amount))
  const fees = roundCents(sum(feeLines))
  const feesInBase = sum(feeLines.filter((_, i) => input.fees[i].inElectricityTaxBase))

  const electricityTaxBase = roundCents(power + energy - discounts + feesInBase)
  const electricityTax = roundCents((electricityTaxBase * input.electricityTaxPct) / 100)

  // Bases del IGIC o IVA, agrupadas por tipo: el suministro va a un tipo y cada cargo al suyo.
  const bases = new Map()
  const addBase = (pct, amount) => bases.set(pct, (bases.get(pct) ?? 0) + amount)
  addBase(input.supplyTaxPct, power + energy - discounts + electricityTax)
  input.fees.forEach((fee, i) => addBase(fee.taxPct, feeLines[i]))

  const taxes = [...bases.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pct, base]) => ({ pct, base: roundCents(base), amount: roundCents((roundCents(base) * pct) / 100) }))
  const taxTotal = roundCents(sum(taxes.map((tax) => tax.amount)))

  const total = roundCents(power + energy - discounts + fees + electricityTax + taxTotal)
  const toPay = roundCents(total + sum((input.afterTotal ?? []).map((line) => line.amount)))

  return {
    power: { lines: powerLines, total: power },
    energy: { lines: energyLines, total: energy },
    discounts: { lines: discountLines, total: discounts },
    fees: { lines: feeLines, total: fees },
    electricityTax: { base: electricityTaxBase, amount: electricityTax },
    taxes,
    taxTotal,
    total,
    toPay,
  }
}

/** Datos de factura que saldrían de un contrato para un consumo y un número de días */
export function invoiceInputFor(contract, days, kwhByBand) {
  const energy =
    contract.mode === 'fija'
      ? [{ label: 'Energía', kwh: kwhByBand.punta + kwhByBand.llano + kwhByBand.valle, price: contract.fixedPrice }]
      : [
          { label: 'Energía punta', kwh: kwhByBand.punta, price: contract.prices.punta },
          { label: 'Energía llano', kwh: kwhByBand.llano, price: contract.prices.llano },
          { label: 'Energía valle', kwh: kwhByBand.valle, price: contract.prices.valle },
        ]

  return {
    power: [
      { label: 'Potencia punta-llano', days, ...contract.power.puntaLlano },
      { label: 'Potencia valle', days, ...contract.power.valle },
    ],
    energy,
    discounts: contract.discounts,
    fees: contract.dailyFees.map((fee) => ({
      label: fee.label,
      amount: dailyAmount(days, fee.pricePerDay),
      inElectricityTaxBase: fee.inElectricityTaxBase,
      taxPct: fee.taxPct,
    })),
    electricityTaxPct: contract.electricityTaxPct,
    supplyTaxPct: contract.supplyTaxPct,
  }
}

/**
 * Estimación de la factura de un periodo con este contrato. `extraFees` son cargos de una
 * factura concreta que no forman parte del contrato, como una actuación puntual en el contador.
 */
export function estimateInvoice(
  contract,
  days,
  kwhByBand,
  extraFees = [],
  /** Descuentos de ese mes apuntados a mano, además de los del contrato */
  extraDiscounts = [],
) {
  const input = invoiceInputFor(contract, days, kwhByBand)
  return computeInvoice({ ...input, fees: [...input.fees, ...extraFees], discounts: [...input.discounts, ...extraDiscounts] })
}

/**
 * Los descuentos apuntados a mano en Descuentos, con la forma de los del contrato, para sumarlos a la
 * estimación de su mes. Los que vienen de una factura no: esa factura ya está cerrada.
 */
export const manualDiscounts = (entries) =>
  entries
    .filter((entry) => entry.source === 'manual')
    .map((entry) =>
      entry.type === 'percent'
        ? { label: entry.label, type: 'percent', pct: entry.value }
        : { label: entry.label, type: 'amount', amount: entry.value },
    )

/** Los cargos de una factura que no se repiten: se cobran esa vez y no salen del contrato */
export function oneOffFees(invoice) {
  return invoice.lines
    .filter((line) => line.kind === 'oneoff')
    .map((line) => ({ label: line.label, amount: line.amount, inElectricityTaxBase: false, taxPct: line.taxPct ?? 0 }))
}
