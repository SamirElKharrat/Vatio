import { weekdayOf } from './time'

/**
 * Festivos que el peaje 2.0TD trata como valle todo el día: los nacionales
 * de fecha fija y no sustituibles, más el 6 de enero. No cambian de un año a otro.
 */
const VALLE_HOLIDAYS = new Set(['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'])

/** Sábados, domingos y festivos nacionales son valle las 24 horas */
export function isValleDay(date) {
  return weekdayOf(date) >= 5 || VALLE_HOLIDAYS.has(date.slice(5))
}

/** Tramo del peaje 2.0TD para una hora (0–23) de una fecha */
export function bandAt(date, hour) {
  if (isValleDay(date)) return 'valle'
  if (hour < 8) return 'valle'
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return 'punta'
  return 'llano'
}

/** €/kWh que se paga a una hora de una fecha con este contrato */
export function priceAt(contract, date, hour) {
  return contract.mode === 'fija' ? contract.fixedPrice : contract.prices[bandAt(date, hour)]
}

/** Los 24 tramos del día, para pintar la banda */
export function dayBands(date) {
  return Array.from({ length: 24 }, (_, hour) => bandAt(date, hour))
}
