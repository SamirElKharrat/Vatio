import { bandAt, priceAt } from './tariff'
import { QUARTER } from './time'

export const usageKwh = (watts, hours) => (watts / 1000) * hours

/**
 * Vatios con los que se calcula la energía de un uso. Si el uso lleva sus kWh (un programa eco), o el
 * aparato está en modo «kWh por uso», esa energía se reparte por igual en lo que dura el uso; si no,
 * son los vatios del aparato. El aviso de potencia no usa esto: allí cuentan los vatios del aparato,
 * que son el máximo que puede pedir.
 */
export function usageWatts(device, usage) {
  const kwh = usage.kwh ?? device.kwhPerUse ?? null
  return kwh && usage.hours > 0 ? (kwh * 1000) / usage.hours : device.watts
}

/** Recorre un uso en cuartos de hora. Va con índices enteros para no acumular error de coma flotante. */
function eachQuarter(start, hours, visit) {
  const first = Math.round(start * 4)
  const last = Math.round((start + hours) * 4)
  for (let q = first; q < last; q++) visit(Math.floor(q / 4) % 24)
}

/** Coste en euros de un uso, sin redondear */
export function usageCost(contract, watts, date, start, hours) {
  let cost = 0
  eachQuarter(start, hours, (hour) => {
    cost += (watts / 1000) * QUARTER * priceAt(contract, date, hour)
  })
  return cost
}

/** kWh de un uso repartidos por tramo */
export function usageKwhByBand(watts, date, start, hours) {
  const byBand = { valle: 0, llano: 0, punta: 0 }
  eachQuarter(start, hours, (hour) => {
    byBand[bandAt(date, hour)] += (watts / 1000) * QUARTER
  })
  return byBand
}

/** kWh de un uso repartidos en las 24 horas del día */
export function usageHourlyKwh(watts, start, hours) {
  const hourly = new Array(24).fill(0)
  eachQuarter(start, hours, (hour) => {
    hourly[hour] += (watts / 1000) * QUARTER
  })
  return hourly
}

/**
 * Consumo y coste de los consumos fijos durante un día entero, en total y por cada uno
 * (`byLoad`, con la clave del aparato, o la del fijo si no tiene aparato)
 */
export function fixedDay(contract, fixedLoads, date) {
  let kwh = 0
  let cost = 0
  const byLoad = {}
  for (const load of fixedLoads) {
    const loadKwh = usageKwh(load.watts, 24)
    const loadCost = usageCost(contract, load.watts, date, 0, 24)
    kwh += loadKwh
    cost += loadCost
    byLoad[load.deviceId ?? load.id] = { kwh: loadKwh, cost: loadCost }
  }
  return { kwh, cost, byLoad }
}
