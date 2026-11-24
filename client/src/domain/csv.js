import { addDays as addDaysISO, format, parseISO } from 'date-fns'
import { usageCost, usageKwh, usageKwhByBand, usageWatts } from './cost'
import { usagesFor } from './routines'
import { datesBetween, formatHM } from './time'

/** Como mucho tres meses por descarga: del 1 de septiembre al 30 de noviembre, por ejemplo */
export const MAX_EXPORT_MONTHS = 3

/** Último día que se puede pedir empezando en `from`: tres meses menos un día */
export function lastExportDay(from) {
  const date = parseISO(from)
  const threeMonths = new Date(date)
  threeMonths.setMonth(threeMonths.getMonth() + MAX_EXPORT_MONTHS)
  // Si el mes de llegada es más corto (31 de enero + 3 meses), se queda en su último día
  if (threeMonths.getDate() !== date.getDate()) threeMonths.setDate(0)
  return format(addDaysISO(threeMonths, -1), 'yyyy-MM-dd')
}

/** Qué falla en el periodo elegido para descargar, o `null` si vale */
export function exportRangeProblem(from, to, today) {
  if (!from || !to) return 'Elige las dos fechas.'
  if (to < from) return 'La fecha final no puede ser anterior a la inicial.'
  if (to > today) return 'La fecha final no puede ser posterior a hoy.'
  const last = lastExportDay(from)
  if (to > last) return `Como máximo ${MAX_EXPORT_MONTHS} meses: desde esa fecha, hasta el ${format(parseISO(last), 'dd/MM/yyyy')}.`
  return null
}

const ORIGIN = { manual: 'Manual', routine: 'Rutina', fixed: 'Fijo' }

/**
 * Una fila por uso de cada día (los apuntados a mano y los de las rutinas, con las saltadas y los
 * cambios ya aplicados) y una por día y consumo fijo. Se calcula con las mismas funciones que las
 * pantallas, así que los kWh y los euros coinciden con lo que se ve.
 */
export function consumptionRows(home, from, to) {
  const devices = new Map(home.devices.map((device) => [device.id, device]))
  const rows = []
  // `watts` es la potencia del aparato; `energyWatts`, con la que se calcula la energía (kWh por uso)
  const add = (date, name, origin, watts, start, hours, energyWatts = watts, note = '') => {
    const bands = usageKwhByBand(energyWatts, date, start, hours)
    rows.push({
      date,
      name,
      origin,
      start,
      hours,
      watts,
      bands,
      kwh: usageKwh(energyWatts, hours),
      cost: usageCost(home.contract, energyWatts, date, start, hours),
      note,
    })
  }

  for (const date of datesBetween(from, to)) {
    const usages = [...usagesFor(date, home.usages, home.routines)].sort((a, b) => a.start - b.start)
    for (const usage of usages) {
      const device = devices.get(usage.deviceId)
      if (!device) continue
      const origin = usage.routineId ? ORIGIN.routine : ORIGIN.manual
      add(date, device.name, origin, device.watts, usage.start, usage.hours, usageWatts(device, usage), usage.note ?? '')
    }
    for (const load of home.fixedLoads) add(date, load.name, ORIGIN.fixed, load.watts, 0, 24)
  }
  return rows
}

const HEADER = [
  'Fecha',
  'Aparato',
  'Origen',
  'Inicio',
  'Fin',
  'Horas',
  'Potencia (W)',
  'kWh punta',
  'kWh llano',
  'kWh valle',
  'kWh total',
  'Coste estimado (€)',
  'Comentario',
]

/** Cifra con coma decimal, como la espera Excel en español */
const decimal = (value, digits) => value.toFixed(digits).replace('.', ',')

/** Un campo con «;», comillas o saltos de línea va entre comillas, con las comillas dobladas */
const field = (value) => {
  const text = String(value)
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Las filas como CSV para Excel en español: separado por «;», decimales con coma y UTF-8 con BOM
 * para que salgan bien las tildes. El coste lleva 4 decimales para que la suma de la columna dé lo
 * mismo que los totales de la app al céntimo.
 */
export function toCsv(rows) {
  const lines = [HEADER, ...rows.map((row) => [
    row.date,
    row.name,
    row.origin,
    formatHM(row.start),
    formatHM(row.start + row.hours),
    decimal(row.hours, 2),
    row.watts,
    decimal(row.bands.punta, 3),
    decimal(row.bands.llano, 3),
    decimal(row.bands.valle, 3),
    decimal(row.kwh, 3),
    decimal(row.cost, 4),
    row.note ?? '',
  ])]
  return '﻿' + lines.map((line) => line.map(field).join(';')).join('\r\n') + '\r\n'
}

/** Nombre del archivo: vatios-consumo-2026-09-01_2026-11-30.csv */
export const exportFileName = (from, to) => `vatios-consumo-${from}_${to}.csv`
