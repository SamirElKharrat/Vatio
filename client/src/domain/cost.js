import { bandAt, priceAt } from './tariff'
import { QUARTER } from './time'

export const usageKwh = (watts, hours) => (watts / 1000) * hours

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

/** Consumo y coste de los consumos fijos durante un día entero */
export function fixedDay(contract, fixedLoads, date) {
  let kwh = 0
  let cost = 0
  for (const load of fixedLoads) {
    kwh += usageKwh(load.watts, 24)
    cost += usageCost(contract, load.watts, date, 0, 24)
  }
  return { kwh, cost }
}
