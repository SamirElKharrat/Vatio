import { describe, expect, it } from 'vitest'
import { periodSummary } from './aggregates'
import { usageCost, usageKwh, usageKwhByBand, usageWatts } from './cost'
import { consumptionRows, toCsv } from './csv'
import { contract, home, MONDAY } from './fixtures/prototype'
import { addDays, datesBetween } from './time'

const lavadora = { id: 'lav', name: 'Lavadora', watts: 2000, kwhPerUse: 0.9 }
const kwhOf = (device, usage) => usageKwh(usageWatts(device, usage), usage.hours)
const costOf = (device, usage) => usageCost(contract, usageWatts(device, usage), MONDAY, usage.start, usage.hours)

describe('modo kWh por uso', () => {
  it('un lavado gasta sus kWh dure lo que dure', () => {
    expect(kwhOf(lavadora, { start: 0, hours: 1 })).toBeCloseTo(0.9, 10)
    expect(kwhOf(lavadora, { start: 0, hours: 2 })).toBeCloseTo(0.9, 10)
    // De 0:00 a 2:00 todo es valle: el coste es el mismo con 1 h o con 2 h
    expect(costOf(lavadora, { start: 0, hours: 1 })).toBeCloseTo(costOf(lavadora, { start: 0, hours: 2 }), 10)
  })

  it('si el uso cruza dos tramos, los kWh se reparten en proporción', () => {
    // 7:00–9:00 del lunes: la mitad en valle y la mitad en llano
    const bands = usageKwhByBand(usageWatts(lavadora, { hours: 2 }), MONDAY, 7, 2)
    expect(bands.valle).toBeCloseTo(0.45, 10)
    expect(bands.llano).toBeCloseTo(0.45, 10)
  })

  it('los kWh de un uso mandan sobre los del aparato, y sin ninguno cuentan los vatios', () => {
    expect(kwhOf(lavadora, { start: 0, hours: 1.5, kwh: 0.6 })).toBeCloseTo(0.6, 10)
    expect(kwhOf({ ...lavadora, kwhPerUse: null }, { start: 0, hours: 2 })).toBeCloseTo(4, 10)
  })

  it('las vistas y el CSV cuentan lo mismo con un aparato por uso', () => {
    const perUseHome = {
      ...home,
      devices: home.devices.map((device) => (device.id === 'lav' ? { ...device, kwhPerUse: 0.9 } : device)),
      usages: home.usages.map((usage, i) => (i === 0 ? { ...usage, kwh: 0.6, note: 'Algodón 40° eco' } : usage)),
    }
    const to = addDays(MONDAY, 6)
    const summary = periodSummary(perUseHome, datesBetween(MONDAY, to))
    const rows = consumptionRows(perUseHome, MONDAY, to)
    expect(rows.reduce((total, row) => total + row.cost, 0)).toBeCloseTo(summary.total.cost, 9)
    expect(rows.reduce((total, row) => total + row.kwh, 0)).toBeCloseTo(summary.total.kwh, 9)
    if (home.usages[0]) expect(toCsv(rows)).toContain('Algodón 40° eco')
  })
})
