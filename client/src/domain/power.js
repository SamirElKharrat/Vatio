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
