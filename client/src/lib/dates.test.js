import { describe, expect, it } from 'vitest'
import { dayTitle, isDateISO, monthRange, monthTitle, monthYearTitle, rangeLabel, shiftMonth, weekNumber } from './dates'

describe('fechas para la interfaz', () => {
  it('escribe el día y el mes como en el diseño', () => {
    expect(dayTitle('2026-09-14')).toBe('Lunes 14')
    expect(dayTitle('2026-09-16')).toBe('Miércoles 16')
    expect(monthTitle('2026-09-14')).toBe('Septiembre')
  })

  it('numera las semanas como el calendario ISO', () => {
    expect(weekNumber('2026-09-14')).toBe(38)
    expect(weekNumber('2026-09-20')).toBe(38)
    expect(weekNumber('2027-01-01')).toBe(53)
  })

  it('da el primer y el último día del mes', () => {
    expect(monthRange('2026-09-14')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('salta de mes sin salirse del calendario', () => {
    expect(shiftMonth('2026-10-03', 1)).toBe('2026-11-03')
    expect(shiftMonth('2026-10-31', 1)).toBe('2026-11-30')
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('titula el mes y el rango de la semana', () => {
    expect(monthYearTitle('2026-10-03')).toBe('Octubre 2026')
    expect(rangeLabel('2026-09-28', '2026-10-04')).toBe('28 sep – 4 oct')
  })

  it('reconoce una fecha válida en la dirección', () => {
    expect(isDateISO('2026-09-14')).toBe(true)
    expect(isDateISO('2026-13-40')).toBe(false)
    expect(isDateISO('hoy')).toBe(false)
    expect(isDateISO(undefined)).toBe(false)
  })
})
