import { describe, expect, it } from 'vitest'
import { daySummary, periodSummary } from './aggregates'
import { fixedDay, usageCost, usageKwhByBand } from './cost'
import { contract, home, MONDAY, routines, SATURDAY, TUESDAY, usages } from './fixtures/prototype'
import { eur, kwh } from './format'
import { routineRunsOn, routineStatus, routineWhen, usagesFor } from './routines'
import { bandAt, dayBands, isValleDay } from './tariff'
import { addDays, datesBetween, formatHM, parseHM, parseRange, startOfWeek, weekdayOf } from './time'
import { firstFreeSlot, hasOverlap } from './usages'

describe('horas', () => {
  it('lee las horas escritas de varias formas', () => {
    expect(parseHM('19:30')).toBe(19.5)
    expect(parseHM('7')).toBe(7)
    expect(parseHM('19,5')).toBe(19.5)
    expect(parseHM(' 24:00 ')).toBe(24)
  })

  it('redondea a cuartos de hora', () => {
    expect(parseHM('19:40')).toBe(19.75)
    expect(parseHM('19:07')).toBe(19)
  })

  it('rechaza lo que no es una hora', () => {
    expect(parseHM('')).toBeNull()
    expect(parseHM('tarde')).toBeNull()
    expect(parseHM('25:00')).toBeNull()
    expect(parseHM('19:30 más o menos')).toBeNull()
    expect(parseHM('01:30luego')).toBeNull()
    expect(parseHM('19:75')).toBeNull()
    expect(parseHM(null)).toBeNull()
  })

  it('escribe las horas con dos cifras', () => {
    expect(formatHM(6)).toBe('06:00')
    expect(formatHM(22.75)).toBe('22:45')
  })

  it('convierte dos horas en inicio y duración', () => {
    expect(parseRange('19:00', '21:30')).toEqual({ start: 19, hours: 2.5 })
    expect(parseRange('21:00', '19:00')).toEqual({ error: 'orden' })
    expect(parseRange('19:00', 'luego')).toEqual({ error: 'formato' })
  })
})

describe('fechas', () => {
  it('cuenta la semana desde el lunes', () => {
    expect(weekdayOf(MONDAY)).toBe(0)
    expect(weekdayOf(SATURDAY)).toBe(5)
    expect(startOfWeek(SATURDAY)).toBe(MONDAY)
  })

  it('suma días sin que el cambio de hora mueva la fecha', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('lista los días del periodo de una factura con los dos extremos', () => {
    expect(datesBetween('2026-08-28', '2026-09-19')).toHaveLength(23)
  })
})

describe('tramos de la 2.0TD', () => {
  it('reparte un día laborable en valle, llano y punta', () => {
    expect(bandAt(MONDAY, 0)).toBe('valle')
    expect(bandAt(MONDAY, 7)).toBe('valle')
    expect(bandAt(MONDAY, 8)).toBe('llano')
    expect(bandAt(MONDAY, 10)).toBe('punta')
    expect(bandAt(MONDAY, 14)).toBe('llano')
    expect(bandAt(MONDAY, 18)).toBe('punta')
    expect(bandAt(MONDAY, 22)).toBe('llano')
    const bands = dayBands(MONDAY)
    expect(bands.filter((band) => band === 'valle')).toHaveLength(8)
    expect(bands.filter((band) => band === 'punta')).toHaveLength(8)
  })

  it('pone en valle todo el fin de semana', () => {
    expect(dayBands(SATURDAY).every((band) => band === 'valle')).toBe(true)
    expect(dayBands('2026-09-20').every((band) => band === 'valle')).toBe(true)
  })

  it('pone en valle los festivos nacionales aunque caigan entre semana', () => {
    // El 12 de octubre de 2026 es lunes
    expect(weekdayOf('2026-10-12')).toBe(0)
    expect(isValleDay('2026-10-12')).toBe(true)
    expect(bandAt('2026-10-12', 11)).toBe('valle')
    expect(isValleDay('2026-10-13')).toBe(false)
  })
})

describe('coste de un uso', () => {
  it('cobra cada cuarto de hora al precio de su tramo', () => {
    // Aire de 1.100 W de 16:00 a 18:30: dos horas en llano y media en punta
    expect(usageCost(contract, 1100, MONDAY, 16, 2.5)).toBeCloseTo(0.49665, 10)
    expect(usageKwhByBand(1100, MONDAY, 16, 2.5)).toEqual({
      valle: 0,
      llano: expect.closeTo(2.2, 10),
      punta: expect.closeTo(0.55, 10),
    })
  })

  it('con precio fijo cobra lo mismo a cualquier hora', () => {
    const fija = { ...contract, mode: 'fija' }
    expect(usageCost(fija, 1000, MONDAY, 3, 1)).toBeCloseTo(0.1489, 10)
    expect(usageCost(fija, 1000, MONDAY, 19, 1)).toBeCloseTo(0.1489, 10)
  })
})

describe('solapes', () => {
  const monday = usages.filter((usage) => usage.date === MONDAY)

  it('detecta un uso del mismo aparato en la misma franja', () => {
    expect(hasOverlap(monday, 'lav', 20, 2)).toBe(true)
    expect(hasOverlap(monday, 'lav', 21, 1)).toBe(false)
    expect(hasOverlap(monday, 'sec', 20, 2)).toBe(false)
  })

  it('no cuenta el propio uso al editarlo', () => {
    expect(hasOverlap(monday, 'lav', 19.5, 2, '4')).toBe(false)
  })

  it('busca el primer hueco libre del día', () => {
    expect(firstFreeSlot(monday, 'sec', 1.5)).toBe(0)
    expect(firstFreeSlot([{ id: 'x', deviceId: 'sec', date: MONDAY, start: 0, hours: 3 }], 'sec', 1.5)).toBe(3)
  })
})

describe('rutinas', () => {
  it('añade las rutinas que tocan ese día', () => {
    const monday = usagesFor(MONDAY, usages, routines)
    expect(monday.filter((usage) => usage.routineId).map((usage) => usage.routineId)).toEqual(['r1'])
    expect(monday).toHaveLength(7)
  })

  it('no añade una rutina que choca con un uso apuntado del mismo aparato', () => {
    // El lunes hay un lavavajillas a mano de 22:30 a 24:00 y la rutina lo pondría de 22:00 a 23:30
    expect(usagesFor(MONDAY, usages, routines).some((usage) => usage.routineId === 'r2')).toBe(false)
    // El miércoles no hay nada apuntado y la rutina sí entra
    expect(usagesFor('2026-09-16', usages, routines).some((usage) => usage.routineId === 'r2')).toBe(true)
  })

  it('salta sólo el día indicado', () => {
    const skipped = { ...routines[0], skippedDates: [TUESDAY] }
    expect(routineRunsOn(skipped, MONDAY)).toBe(true)
    expect(routineRunsOn(skipped, TUESDAY)).toBe(false)
    expect(routineRunsOn(skipped, '2026-09-16')).toBe(true)
  })

  it('se pausa desde una fecha en adelante', () => {
    const paused = { ...routines[0], pausedFrom: TUESDAY }
    expect(routineRunsOn(paused, MONDAY)).toBe(true)
    expect(routineRunsOn(paused, TUESDAY)).toBe(false)
    expect(routineRunsOn(paused, '2026-10-01')).toBe(false)
  })

  it('da un único estado por fecha: pausada manda sobre saltada, y saltada sobre «no toca»', () => {
    const base = { ...routines[2], skippedDates: [], pausedFrom: null } // sábados y domingos
    expect(routineStatus(base, SATURDAY)).toBe('active')
    expect(routineStatus(base, MONDAY)).toBe('off')
    expect(routineStatus({ ...base, skippedDates: [SATURDAY] }, SATURDAY)).toBe('skipped')
    // Un salto guardado en un día que no toca sigue saliendo, para poder quitarlo
    expect(routineStatus({ ...base, skippedDates: [MONDAY] }, MONDAY)).toBe('skipped')
    expect(routineStatus({ ...base, skippedDates: [SATURDAY], pausedFrom: MONDAY }, SATURDAY)).toBe('paused')
  })

  it('una pausa con fecha futura no cambia el estado de hoy', () => {
    const later = { ...routines[0], pausedFrom: '2026-10-01' }
    expect(routineStatus(later, MONDAY)).toBe('active')
    expect(routineStatus(later, '2026-10-01')).toBe('paused')
  })

  it('describe cuándo se repite', () => {
    expect(routineWhen([0, 1, 2, 3, 4, 5, 6], '14:00')).toBe('todos los días a las 14:00')
    expect(routineWhen([4, 0, 2], '22:00')).toBe('L · X · V a las 22:00')
  })
})

// Las cifras de referencia salen de ejecutar las funciones del propio prototipo con sus datos de ejemplo.
describe('totales de la casa del prototipo', () => {
  it('el lunes suma 15,10 kWh y 2,77 €', () => {
    const day = daySummary(home, MONDAY)
    expect(day.kwh).toBeCloseTo(15.1, 10)
    expect(day.cost).toBeCloseTo(2.7677, 10)
    expect(kwh(day.kwh)).toBe('15,10 kWh')
    expect(eur(day.cost)).toBe('2,77 €')
  })

  it('el sábado, todo en valle, suma 12,05 kWh y 1,14 €', () => {
    const day = daySummary(home, SATURDAY)
    expect(day.kwh).toBeCloseTo(12.05, 10)
    expect(day.cost).toBeCloseTo(1.14475, 10)
    expect(day.valleSaving).toBeCloseTo(0, 10)
  })

  it('los consumos fijos gastan 2,736 kWh al día', () => {
    expect(fixedDay(contract, home.fixedLoads, MONDAY).kwh).toBeCloseTo(2.736, 10)
    expect(fixedDay(contract, home.fixedLoads, MONDAY).cost).toBeCloseTo(0.46968, 10)
    expect(fixedDay(contract, home.fixedLoads, SATURDAY).cost).toBeCloseTo(0.25992, 10)
  })

  it('con precio fijo el lunes cuesta 2,25 €', () => {
    const fija = { ...home, contract: { ...contract, mode: 'fija' } }
    const day = daySummary(fija, MONDAY)
    expect(day.cost).toBeCloseTo(2.24839, 10)
    expect(day.valleSaving).toBe(0)
  })

  it('calcula lo que se ahorraría pagando todo a precio de valle', () => {
    const day = daySummary(home, MONDAY)
    expect(day.valleSaving).toBeCloseTo(2.7677 - 15.1 * 0.095, 10)
  })

  it('reparte el día por aparato, por tramo y por hora', () => {
    const day = daySummary(home, MONDAY)
    expect(day.byDevice.ter).toEqual({ kwh: 4.5, cost: expect.closeTo(0.576, 10), uses: 2 })
    expect(day.byBand.valle + day.byBand.llano + day.byBand.punta).toBeCloseTo(day.kwh, 10)
    expect(day.hourlyKwh.reduce((a, b) => a + b, 0)).toBeCloseTo(day.kwh, 10)
    expect(day.hourlyKwh[20]).toBeCloseTo(1.2 + 2, 10)
    expect(day.total.kwh).toBeCloseTo(15.1 + 2.736, 10)
  })

  it('la semana es la suma de sus días', () => {
    const week = periodSummary(home, datesBetween(MONDAY, '2026-09-20'))
    const days = week.days
    expect(days).toHaveLength(7)
    expect(week.kwh).toBeCloseTo(days.reduce((a, day) => a + day.kwh, 0), 10)
    expect(week.total.cost).toBeCloseTo(week.cost + week.fixed.cost, 10)
    expect(week.fixed.kwh).toBeCloseTo(2.736 * 7, 10)
    expect(week.byBand.valle + week.byBand.llano + week.byBand.punta).toBeCloseTo(week.total.kwh, 10)
    expect(week.byDevice.ter.uses).toBe(9)
  })

  it('cada consumo fijo cuenta por su aparato todos los días, sin sumar dos veces', () => {
    const week = periodSummary(home, datesBetween(MONDAY, '2026-09-20'))
    // La nevera de 45 W: 45 W × 24 h × 7 días
    expect(week.byDevice.nev).toMatchObject({ uses: 0, fixed: true, fixedDays: 7 })
    expect(week.byDevice.nev.kwh).toBeCloseTo(0.045 * 24 * 7, 10)
    const sum = (key) => Object.values(week.byDevice).reduce((total, item) => total + item[key], 0)
    expect(sum('kwh')).toBeCloseTo(week.total.kwh, 10)
    expect(sum('cost')).toBeCloseTo(week.total.cost, 10)
  })
})
