import { describe, expect, it } from 'vitest'
import { contractedWatts, convertPower, fromWatts, powerProfile, storedWatts, toWatts } from './power'

const MONDAY = '2026-09-14'
const SATURDAY = '2026-09-19'

const contract = {
  mode: 'fija',
  fixedPrice: 0.15,
  prices: { valle: 0.15, llano: 0.15, punta: 0.15 },
  // Distintas a propósito: 3,45 kW en punta-llano (P1) y 5 kW en valle (P3)
  power: { puntaLlano: { kw: 3.45, pricePerKwDay: 0.1 }, valle: { kw: 5, pricePerKwDay: 0.04 } },
  discounts: [],
  dailyFees: [],
  electricityTaxPct: 0,
  supplyTaxPct: 0,
}
const devices = [
  { id: 'horno', name: 'Horno', watts: 2000 },
  { id: 'lava', name: 'Lavadora', watts: 1200 },
  { id: 'vitro', name: 'Vitrocerámica', watts: 1800 },
]
const fixedLoads = [{ id: 'f1', deviceId: 'nevera', name: 'Nevera', watts: 100 }]
const usage = (deviceId, date, start, hours) => ({ id: `${deviceId}-${date}-${start}`, deviceId, date, start, hours })
const homeWith = (usages, overrides = {}) => ({ contract, devices, fixedLoads, routines: [], usages, ...overrides })

describe('aviso de potencia', () => {
  it('usa la potencia de punta-llano o la de valle según la hora', () => {
    expect(contractedWatts(contract, MONDAY, 7)).toBe(5000)
    expect(contractedWatts(contract, MONDAY, 8)).toBe(3450)
    expect(contractedWatts(contract, MONDAY, 23)).toBe(3450)
    expect(contractedWatts(contract, SATURDAY, 20)).toBe(5000)
  })

  it('suma los usos que coinciden y los fijos, y marca la franja que pasa del límite', () => {
    const home = homeWith([usage('horno', MONDAY, 19, 1.5), usage('lava', MONDAY, 19.5, 1.5), usage('vitro', MONDAY, 20, 0.5)])
    const { slots, over, fixedWatts } = powerProfile(home, MONDAY)
    expect(fixedWatts).toBe(100)
    expect(slots[0].watts).toBe(100)
    // 19:45: horno y lavadora (2000 + 1200 + 100 de la nevera) se quedan por debajo de 3450
    expect(slots[19 * 4 + 3].watts).toBe(3300)
    // De 20:00 a 20:30 entra la vitro: 5100 W
    expect(over).toEqual([
      { start: 20, end: 20.5, peakWatts: 5100, limitWatts: 3450, deviceIds: ['horno', 'lava', 'vitro'] },
    ])
  })

  it('lo mismo que salta a las 9:00 cabe a las 7:00, con la potencia de valle', () => {
    const home = homeWith([usage('horno', MONDAY, 7, 3), usage('vitro', MONDAY, 7, 3)])
    const { over } = powerProfile(home, MONDAY)
    // 3900 W: cabe en los 5 kW de valle (hasta las 8) y no en los 3,45 kW de llano
    expect(over).toEqual([{ start: 8, end: 10, peakWatts: 3900, limitWatts: 3450, deviceIds: ['horno', 'vitro'] }])
  })

  it('el sábado todo el día vale la potencia de valle', () => {
    const home = homeWith([usage('horno', SATURDAY, 19, 1), usage('vitro', SATURDAY, 19, 1)])
    expect(powerProfile(home, SATURDAY).over).toEqual([])
  })

  it('cuenta también los usos de las rutinas', () => {
    const routine = { id: 'r1', deviceId: 'vitro', start: 20, hours: 0.5, weekdays: [0, 1, 2, 3, 4, 5, 6], skippedDates: [], pausedFrom: null }
    const home = homeWith([usage('horno', MONDAY, 20, 1)], { routines: [routine] })
    expect(powerProfile(home, MONDAY).over).toEqual([
      { start: 20, end: 20.5, peakWatts: 3900, limitWatts: 3450, deviceIds: ['horno', 'vitro'] },
    ])
  })

  it('sin potencia en el contrato no avisa de nada', () => {
    const noPower = { ...contract, power: { puntaLlano: { kw: 0, pricePerKwDay: 0 }, valle: { kw: 0, pricePerKwDay: 0 } } }
    const result = powerProfile(homeWith([usage('horno', MONDAY, 19, 2), usage('vitro', MONDAY, 19, 2)], { contract: noPower }), MONDAY)
    expect(result.hasLimit).toBe(false)
    expect(result.over).toEqual([])
  })
})

describe('unidades de potencia', () => {
  it('pasa cada unidad a vatios', () => {
    expect(toWatts({ unit: 'W', value: '1200' })).toBe(1200)
    expect(toWatts({ unit: 'kW', value: '1,2' })).toBe(1200)
    expect(storedWatts(toWatts({ unit: 'kWhYear', value: '300' }))).toBe(34)
    expect(toWatts({ unit: 'VA', volts: '12', amps: '1,5' })).toBe(18)
  })

  it('sin cifra no da resultado, en vez de un cero engañoso', () => {
    expect(toWatts({ unit: 'kW', value: '' })).toBeNull()
    expect(toWatts({ unit: 'kW', value: 'abc' })).toBeNull()
    expect(toWatts({ unit: 'VA', volts: '12', amps: '' })).toBeNull()
    expect(storedWatts(null)).toBeNull()
    expect(storedWatts(0.2)).toBe(1)
  })

  it('la inversa vuelve a la cifra de partida', () => {
    expect(fromWatts(1200, { unit: 'kW' })).toBe(1.2)
    expect(fromWatts(toWatts({ unit: 'kWhYear', value: '300' }), { unit: 'kWhYear' })).toBeCloseTo(300, 9)
    expect(Math.round(fromWatts(45, { unit: 'kWhYear' }))).toBe(394)
  })

  it('de W a V × A da los amperios con los voltios que se digan, 230 si no', () => {
    expect(fromWatts(2000, { unit: 'VA' })).toBeCloseTo(8.7, 1)
    expect(fromWatts(18, { unit: 'VA', volts: '12' })).toBe(1.5)
    expect(fromWatts(18, { unit: 'VA', volts: '0' })).toBeNull()
  })

  it('encadena dos unidades pasando por vatios', () => {
    expect(Math.round(convertPower({ unit: 'kW', value: '0,045' }, { unit: 'kWhYear' }))).toBe(394)
    expect(convertPower({ unit: 'kWhYear', value: '' }, { unit: 'kW' })).toBeNull()
  })
})
