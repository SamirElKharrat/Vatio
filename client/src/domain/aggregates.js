import { fixedDay, usageCost, usageHourlyKwh, usageKwh, usageKwhByBand } from './cost'
import { usagesFor } from './routines'

export function daySummary(home, date) {
  const usages = usagesFor(date, home.usages, home.routines)
  const devices = new Map(home.devices.map((device) => [device.id, device]))
  const byDevice = {}
  const byBand = { valle: 0, llano: 0, punta: 0 }
  const hourlyKwh = new Array(24).fill(0)
  let kwh = 0
  let cost = 0

  for (const usage of usages) {
    const device = devices.get(usage.deviceId)
    if (!device) continue
    const usageEnergy = usageKwh(device.watts, usage.hours)
    const usagePrice = usageCost(home.contract, device.watts, date, usage.start, usage.hours)
    kwh += usageEnergy
    cost += usagePrice

    const totals = (byDevice[device.id] ??= { kwh: 0, cost: 0, uses: 0 })
    totals.kwh += usageEnergy
    totals.cost += usagePrice
    totals.uses += 1

    const bands = usageKwhByBand(device.watts, date, usage.start, usage.hours)
    byBand.valle += bands.valle
    byBand.llano += bands.llano
    byBand.punta += bands.punta

    usageHourlyKwh(device.watts, usage.start, usage.hours).forEach((value, hour) => {
      hourlyKwh[hour] += value
    })
  }

  const fixed = fixedDay(home.contract, home.fixedLoads, date)
  const valleSaving = home.contract.mode === 'tramos' ? Math.max(0, cost - kwh * home.contract.prices.valle) : 0

  return {
    date,
    usages,
    kwh,
    cost,
    valleSaving,
    fixed,
    total: { kwh: kwh + fixed.kwh, cost: cost + fixed.cost },
    byDevice,
    byBand,
    hourlyKwh,
  }
}

/** Suma de varios días: una semana, un mes o el periodo de una factura */
export function periodSummary(home, dates) {
  const days = dates.map((date) => daySummary(home, date))
  const summary = {
    days,
    kwh: 0,
    cost: 0,
    fixed: { kwh: 0, cost: 0 },
    total: { kwh: 0, cost: 0 },
    byDevice: {},
    byBand: { valle: 0, llano: 0, punta: 0 },
  }
  const fixedWatts = home.fixedLoads.reduce((watts, load) => watts + load.watts, 0)

  for (const day of days) {
    summary.kwh += day.kwh
    summary.cost += day.cost
    summary.fixed.kwh += day.fixed.kwh
    summary.fixed.cost += day.fixed.cost
    summary.total.kwh += day.total.kwh
    summary.total.cost += day.total.cost

    for (const [deviceId, totals] of Object.entries(day.byDevice)) {
      const acc = (summary.byDevice[deviceId] ??= { kwh: 0, cost: 0, uses: 0 })
      acc.kwh += totals.kwh
      acc.cost += totals.cost
      acc.uses += totals.uses
    }
    // Los consumos fijos también cuentan por aparato: todo el día, todos los días del periodo
    for (const [deviceId, totals] of Object.entries(day.fixed.byLoad)) {
      const acc = (summary.byDevice[deviceId] ??= { kwh: 0, cost: 0, uses: 0 })
      acc.kwh += totals.kwh
      acc.cost += totals.cost
      acc.fixed = true
      acc.fixedDays = (acc.fixedDays ?? 0) + 1
    }

    const fixedBands = usageKwhByBand(fixedWatts, day.date, 0, 24)
    summary.byBand.valle += day.byBand.valle + fixedBands.valle
    summary.byBand.llano += day.byBand.llano + fixedBands.llano
    summary.byBand.punta += day.byBand.punta + fixedBands.punta
  }
  return summary
}
