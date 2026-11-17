import { Contract } from './models.js'

/**
 * Una cuenta nueva empieza vacía: sin aparatos, consumos fijos ni rutinas, y con un contrato
 * a cero que la persona rellena en Tarifa (o al importar su primera factura). El contrato
 * tiene que existir porque todas las cuentas del consumo parten de él.
 */
export async function createEmptyHousehold(userId, transaction) {
  await Contract.create(
    {
      userId,
      provider: null,
      mode: 'fija',
      fixedPrice: 0,
      pricePunta: 0,
      priceLlano: 0,
      priceValle: 0,
      powerKwPuntaLlano: 0,
      powerKwValle: 0,
      powerPricePuntaLlano: 0,
      powerPriceValle: 0,
      discounts: [],
      dailyFees: [],
      electricityTaxPct: 0,
      supplyTaxPct: 0,
    },
    { transaction },
  )
}

// Formas que recibe el cliente: las mismas que usa su lógica de cálculo

export const deviceJson = (device) => ({
  id: device.id,
  name: device.name,
  watts: device.watts,
  defaultHours: device.defaultHours,
  color: device.color,
})

export const usageJson = (usage) => ({
  id: usage.id,
  deviceId: usage.deviceId,
  date: usage.date,
  start: usage.start,
  hours: usage.hours,
})

export const fixedLoadJson = (load) => ({
  id: load.id,
  name: load.name,
  watts: load.watts,
  color: load.color,
  note: load.note,
})

export const routineJson = (routine) => ({
  id: routine.id,
  name: routine.name,
  deviceId: routine.deviceId,
  start: routine.start,
  hours: routine.hours,
  weekdays: routine.weekdays,
  note: routine.note,
  skippedDates: (routine.skips ?? []).map((skip) => skip.date).sort(),
  pausedFrom: routine.pausedFrom ?? null,
})

export const contractJson = (contract) => ({
  provider: contract.provider ?? null,
  mode: contract.mode,
  fixedPrice: contract.fixedPrice,
  prices: { punta: contract.pricePunta, llano: contract.priceLlano, valle: contract.priceValle },
  power: {
    puntaLlano: { kw: contract.powerKwPuntaLlano, pricePerKwDay: contract.powerPricePuntaLlano },
    valle: { kw: contract.powerKwValle, pricePerKwDay: contract.powerPriceValle },
  },
  discounts: contract.discounts,
  dailyFees: contract.dailyFees,
  electricityTaxPct: contract.electricityTaxPct,
  supplyTaxPct: contract.supplyTaxPct,
})

export const invoiceJson = (invoice) => ({
  id: invoice.id,
  provider: invoice.provider ?? null,
  from: invoice.periodFrom,
  to: invoice.periodTo,
  days: invoice.days ?? daysBetween(invoice.periodFrom, invoice.periodTo),
  total: invoice.total,
  kwh: invoice.kwh,
  kwhByBand:
    invoice.kwhPunta == null || invoice.kwhLlano == null || invoice.kwhValle == null
      ? null
      : { punta: invoice.kwhPunta, llano: invoice.kwhLlano, valle: invoice.kwhValle },
  lines: [...(invoice.lines ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({ kind: line.kind, label: line.label, amount: line.amount, taxPct: line.taxPct ?? null })),
})

/** Días de un periodo contando los dos extremos */
function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
}
