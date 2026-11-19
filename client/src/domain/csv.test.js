import { describe, expect, it } from 'vitest'
import { periodSummary } from './aggregates'
import { consumptionRows, exportRangeProblem, lastExportDay, toCsv } from './csv'
import { home, MONDAY } from './fixtures/prototype'
import { addDays, datesBetween } from './time'

describe('descarga del consumo en CSV', () => {
  const to = addDays(MONDAY, 6)
  const rows = consumptionRows(home, MONDAY, to)

  it('la suma de las filas da lo mismo que los totales de la app', () => {
    const summary = periodSummary(home, datesBetween(MONDAY, to))
    expect(rows.reduce((total, row) => total + row.cost, 0)).toBeCloseTo(summary.total.cost, 9)
    expect(rows.reduce((total, row) => total + row.kwh, 0)).toBeCloseTo(summary.total.kwh, 9)
  })

  it('separa lo apuntado, las rutinas y los fijos, con un fijo por día', () => {
    const origins = new Set(rows.map((row) => row.origin))
    expect(origins).toEqual(new Set(['Manual', 'Rutina', 'Fijo']))
    expect(rows.filter((row) => row.origin === 'Fijo')).toHaveLength(7 * home.fixedLoads.length)
  })

  it('va con «;», coma decimal y BOM, y entrecomilla lo que lo necesita', () => {
    const csv = toCsv([{ ...rows[0], name: 'Tele; salón' }])
    const [header, line] = csv.replace('﻿', '').trim().split('\r\n')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(header).toBe('Fecha;Aparato;Origen;Inicio;Fin;Horas;Potencia (W);kWh punta;kWh llano;kWh valle;kWh total;Coste estimado (€)')
    expect(line).toContain('"Tele; salón"')
    expect(line).toMatch(/;\d+,\d{4}$/)
  })

  it('no deja pasar de tres meses, ni días futuros, ni un final antes del principio', () => {
    expect(lastExportDay('2026-09-01')).toBe('2026-11-30')
    expect(lastExportDay('2026-11-30')).toBe('2027-02-27')
    const today = '2026-11-19'
    expect(exportRangeProblem('2026-08-20', '2026-11-19', today)).toBeNull()
    expect(exportRangeProblem('2026-08-19', '2026-11-19', today)).toContain('Como máximo 3 meses')
    expect(exportRangeProblem('2026-11-01', '2026-11-20', today)).toContain('posterior a hoy')
    expect(exportRangeProblem('2026-11-10', '2026-11-01', today)).toContain('anterior')
  })
})
