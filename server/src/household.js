import { Contract, Device, FixedLoad } from './models.js'

// Punto de partida de una cuenta nueva: los aparatos y consumos fijos de la casa de
// ejemplo del prototipo y un contrato de precio fijo con valores orientativos.
const STARTER_DEVICES = [
  { name: 'Lavadora', watts: 1200, defaultHours: 2, hue: 150 },
  { name: 'Lavavajillas', watts: 1400, defaultHours: 1.5, hue: 205 },
  { name: 'Horno', watts: 2000, defaultHours: 1, hue: 35 },
  { name: 'Vitrocerámica', watts: 1800, defaultHours: 0.75, hue: 65 },
  { name: 'Aire acondicionado', watts: 1100, defaultHours: 3, hue: 265 },
  { name: 'Secadora', watts: 2500, defaultHours: 1.5, hue: 325 },
  { name: 'Termo eléctrico', watts: 1500, defaultHours: 1.5, hue: 110 },
]

const STARTER_FIXED_LOADS = [
  { name: 'Nevera', watts: 45, hue: 150, note: 'arranca por ciclos · media 45 W' },
  { name: 'Congelador', watts: 35, hue: 205, note: 'siempre encendido' },
  { name: 'Router y ONT', watts: 12, hue: 265, note: '24 h' },
  { name: 'TV, consola y standby', watts: 22, hue: 35, note: 'en reposo' },
]

const starterContract = (userId) => ({
  userId,
  provider: null,
  mode: 'fija',
  fixedPrice: 0.1489,
  pricePunta: 0.259,
  priceLlano: 0.161,
  priceValle: 0.095,
  powerKwPuntaLlano: 4.6,
  powerKwValle: 4.6,
  powerPricePuntaLlano: 0.0817,
  powerPriceValle: 0,
  discounts: [],
  dailyFees: [
    { label: 'Financiación bono social', pricePerDay: 0.024688, inElectricityTaxBase: true, taxPct: 0 },
    { label: 'Alquiler del contador', pricePerDay: 0.02663, inElectricityTaxBase: false, taxPct: 7 },
  ],
  electricityTaxPct: 5.1126963,
  supplyTaxPct: 0,
})

/** Crea el contrato, los aparatos y los consumos fijos iniciales de una cuenta */
export async function createStarterHousehold(userId, transaction) {
  await Contract.create(starterContract(userId), { transaction })
  const devices = await Device.bulkCreate(
    STARTER_DEVICES.map((device) => ({ ...device, userId })),
    { transaction },
  )
  await FixedLoad.bulkCreate(
    STARTER_FIXED_LOADS.map((load) => ({ ...load, userId })),
    { transaction },
  )
  return devices
}

// Formas que recibe el cliente: las mismas que usa su lógica de cálculo

export const deviceJson = (device) => ({
  id: device.id,
  name: device.name,
  watts: device.watts,
  defaultHours: device.defaultHours,
  hue: device.hue,
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
  hue: load.hue,
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
