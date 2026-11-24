import { usagesFor } from './routines'
import { bandAt } from './tariff'

/** Cuartos de hora de un día */
export const SLOTS = 96

/**
 * Potencia contratada que vale a una hora, en vatios. En el peaje 2.0TD hay dos: la de punta-llano (P1)
 * para las horas punta y llano, y la de valle (P3) para las de valle, que incluyen las noches y los
 * fines de semana y festivos.
 */
export function contractedWatts(contract, date, hour) {
  const term = bandAt(date, hour) === 'valle' ? contract.power.valle : contract.power.puntaLlano
  return Math.round((term?.kw ?? 0) * 1000)
}

/**
 * Lo que hay encendido a la vez en cada cuarto de hora del día, comparado con la potencia contratada.
 * Suma los W de los usos que coinciden (apuntados y de rutinas) más los consumos fijos, que están
 * siempre enchufados. Los W son los de la etiqueta del aparato: el máximo que puede pedir.
 *
 * Devuelve:
 * - `slots`: 96 cuartos con `watts` (lo encendido), `limit` (lo contratado) y `deviceIds`.
 * - `over`: las franjas seguidas que pasan del límite, con su pico y los aparatos que coinciden.
 * - `hasLimit`: si el contrato tiene potencia; sin ella no hay con qué comparar y `over` va vacío.
 */
export function powerProfile(home, date) {
  const devices = new Map(home.devices.map((device) => [device.id, device]))
  const fixedWatts = home.fixedLoads.reduce((total, load) => total + load.watts, 0)
  const slots = Array.from({ length: SLOTS }, (_, q) => ({
    watts: fixedWatts,
    limit: contractedWatts(home.contract, date, Math.floor(q / 4)),
    deviceIds: [],
  }))

  for (const usage of usagesFor(date, home.usages, home.routines)) {
    const device = devices.get(usage.deviceId)
    if (!device) continue
    const first = Math.round(usage.start * 4)
    const last = Math.min(SLOTS, Math.round((usage.start + usage.hours) * 4))
    for (let q = first; q < last; q++) {
      slots[q].watts += device.watts
      if (!slots[q].deviceIds.includes(device.id)) slots[q].deviceIds.push(device.id)
    }
  }

  const hasLimit = slots.some((slot) => slot.limit > 0)
  const over = []
  if (hasLimit) {
    for (let q = 0; q < SLOTS; q++) {
      const slot = slots[q]
      if (slot.limit <= 0 || slot.watts <= slot.limit) continue
      const last = over.at(-1)
      if (last && last.end === q / 4) {
        last.end = (q + 1) / 4
        last.peakWatts = Math.max(last.peakWatts, slot.watts)
        last.limitWatts = Math.min(last.limitWatts, slot.limit)
        for (const id of slot.deviceIds) if (!last.deviceIds.includes(id)) last.deviceIds.push(id)
      } else {
        over.push({ start: q / 4, end: (q + 1) / 4, peakWatts: slot.watts, limitWatts: slot.limit, deviceIds: [...slot.deviceIds] })
      }
    }
  }
  return { slots, over, hasLimit, fixedWatts }
}

// Conversión de unidades de potencia. Todo se guarda en vatios: cada unidad sabe pasar a W y volver.

/** Horas que tiene un año: 365 × 24 */
export const HOURS_PER_YEAR = 8760
/** Voltios de un enchufe de casa, para pasar W a amperios si no se dice otra cosa */
export const MAINS_VOLTS = 230

export const POWER_UNITS = [
  { id: 'W', label: 'W' },
  { id: 'kW', label: 'kW' },
  { id: 'kWhYear', label: 'kWh al año' },
  { id: 'VA', label: 'V × A' },
]

/** «1,5» o «1.5» → 1.5; `null` si no es una cifra positiva o cero */
export function parseDecimal(text) {
  const clean = String(text ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (clean === '') return null
  const value = Number(clean)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Vatios a partir de una cifra en otra unidad (sin redondear); `null` si falta algún dato.
 * - kW: × 1000.
 * - kWh al año: la potencia media, kWh × 1000 ÷ 8760 h. Para lo que está enchufado siempre.
 * - V × A: voltios por amperios, lo que pone el cargador. Es el máximo; el consumo real suele ser menor.
 */
export function toWatts({ unit, value, volts, amps }) {
  if (unit === 'VA') {
    const v = parseDecimal(volts)
    const a = parseDecimal(amps)
    return v === null || a === null ? null : v * a
  }
  const number = parseDecimal(value)
  if (number === null) return null
  if (unit === 'kW') return number * 1000
  if (unit === 'kWhYear') return (number * 1000) / HOURS_PER_YEAR
  return number
}

/**
 * La inversa: de vatios a otra unidad. Para V × A no hay una sola respuesta (18 W pueden ser
 * 12 V × 1,5 A o 5 V × 3,6 A), así que se dan los voltios y devuelve los amperios.
 */
export function fromWatts(watts, { unit, volts = MAINS_VOLTS }) {
  if (unit === 'kW') return watts / 1000
  if (unit === 'kWhYear') return (watts * HOURS_PER_YEAR) / 1000
  if (unit === 'VA') {
    const v = parseDecimal(volts)
    return v ? watts / v : null
  }
  return watts
}

/** De una unidad a otra pasando por vatios: 0,045 kW → 45 W → 394 kWh al año */
export function convertPower(input, to) {
  const watts = toWatts(input)
  return watts === null ? null : fromWatts(watts, to)
}

/** Vatios para guardar: enteros y al menos 1; `null` si no hay cifra */
export const storedWatts = (watts) => (watts === null || !Number.isFinite(watts) ? null : Math.max(1, Math.round(watts)))
