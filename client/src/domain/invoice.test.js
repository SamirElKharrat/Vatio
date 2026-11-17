import { describe, expect, it } from 'vitest'
import { disa, endesa, endesaContract, endesaKwhByBand } from './fixtures/invoices'
import { computeInvoice, estimateInvoice, oneOffFees } from './invoice'
import { roundCents } from './money'

describe('roundCents', () => {
  it('redondea medio céntimo hacia arriba aunque el binario se quede corto', () => {
    expect(roundCents(9.65 * 0.07)).toBe(0.68)
    expect(roundCents(25 * 0.02663)).toBe(0.67)
    expect(roundCents(1.005)).toBe(1.01)
  })

  it('trata igual los importes negativos', () => {
    expect(roundCents(-1.005)).toBe(-1.01)
  })
})

describe('factura de Endesa', () => {
  const invoice = computeInvoice(endesa)

  it('reproduce cada bloque', () => {
    expect(invoice.power).toEqual({ lines: [20.3, 7.17], total: 27.47 })
    expect(invoice.energy).toEqual({ lines: [39.01, 7.91], total: 46.92 })
    expect(invoice.discounts).toEqual({ lines: [1.17, 3.9, 3.9], total: 8.97 })
    expect(invoice.fees).toEqual({ lines: [0.74, 0.67, 0.13], total: 1.54 })
  })

  it('reproduce los impuestos', () => {
    expect(invoice.electricityTax).toEqual({ base: 66.16, amount: 3.38 })
    expect(invoice.taxes).toEqual([
      { pct: 0, base: 69.54, amount: 0 },
      { pct: 7, base: 0.8, amount: 0.06 },
    ])
    expect(invoice.taxTotal).toBe(0.06)
  })

  it('da 70,40 € de total y 65,40 € a pagar', () => {
    expect(invoice.total).toBe(70.4)
    expect(invoice.toPay).toBe(65.4)
  })
})

describe('factura de DISA', () => {
  const invoice = computeInvoice(disa)

  it('reproduce cada bloque', () => {
    expect(invoice.power).toEqual({ lines: [6.89, 6.89], total: 13.78 })
    expect(invoice.energy).toEqual({ lines: [2.89, 2.54, 6.87], total: 12.3 })
    expect(invoice.discounts).toEqual({ lines: [5], total: 5 })
    expect(invoice.fees).toEqual({ lines: [0.44, 9.04, 0.61], total: 10.09 })
  })

  it('reproduce los impuestos', () => {
    expect(invoice.electricityTax).toEqual({ base: 21.52, amount: 1.1 })
    expect(invoice.taxes).toEqual([
      { pct: 0, base: 22.62, amount: 0 },
      { pct: 7, base: 9.65, amount: 0.68 },
    ])
  })

  it('da 32,95 € de total', () => {
    expect(invoice.total).toBe(32.95)
    expect(invoice.toPay).toBe(32.95)
  })
})

describe('estimación a partir del contrato', () => {
  it('con precio fijo factura todo el consumo en una línea', () => {
    const invoice = estimateInvoice(endesaContract, 30, endesaKwhByBand)
    expect(invoice.power.total).toBe(27.47)
    expect(invoice.energy).toEqual({ lines: [46.92], total: 46.92 })
    expect(invoice.fees).toEqual({ lines: [0.74, 0.8], total: 1.54 })
    // Sin los descuentos de la factura real: 27,47 + 46,92 + 0,74 = 75,13 de base
    expect(invoice.electricityTax).toEqual({ base: 75.13, amount: 3.84 })
    expect(invoice.total).toBe(79.83)
  })

  it('con los descuentos de la factura escritos en euros, cuadra con los 70,40 € facturados', () => {
    const contract = {
      ...endesaContract,
      discounts: [{ label: 'Descuentos de la factura', type: 'amount', amount: 8.97 }],
    }
    const invoice = estimateInvoice(contract, 30, endesaKwhByBand)
    expect(invoice.electricityTax).toEqual({ base: 66.16, amount: 3.38 })
    expect(invoice.total).toBe(70.4)
  })

  it('por tramos factura una línea por tramo', () => {
    const tramos = { ...endesaContract, mode: 'tramos', prices: { punta: 0.25, llano: 0.15, valle: 0.1 } }
    const invoice = estimateInvoice(tramos, 30, endesaKwhByBand)
    expect(invoice.energy.lines).toEqual([14.31, 7.4, 15.86])
    expect(invoice.energy.total).toBe(37.57)
  })

  it('aplica un descuento en porcentaje a toda la energía si no se indica línea', () => {
    const withDiscount = {
      ...endesaContract,
      discounts: [{ label: 'Fidelidad', type: 'percent', pct: 10 }],
    }
    expect(estimateInvoice(withDiscount, 30, endesaKwhByBand).discounts.total).toBe(4.69)
  })

  it('con el contrato y los conceptos que lee el lector de DISA, cuadra con los 32,95 € facturados', () => {
    // Lo que devuelve el servidor al leer el PDF: el bono social y el alquiler vienen como importe
    // de la factura y se guardan repartidos por día
    const contract = {
      ...endesaContract,
      fixedPrice: 0.109,
      power: { puntaLlano: { kw: 3, pricePerKwDay: 0.099909 }, valle: { kw: 3, pricePerKwDay: 0.099909 } },
      discounts: [{ label: 'Descuento Fidelización', type: 'amount', amount: 5 }],
      dailyFees: [
        { label: 'Bono social', pricePerDay: 0.01913, inElectricityTaxBase: true, taxPct: 0 },
        { label: 'Alquiler del contador', pricePerDay: 0.026522, inElectricityTaxBase: false, taxPct: 7 },
      ],
      electricityTaxPct: 5.11269632,
    }
    const lines = [{ kind: 'oneoff', label: 'Actuaciones en la medida', amount: 9.04, taxPct: 7 }]
    const bands = { punta: 26.517, llano: 23.259, valle: 63.038 }

    expect(estimateInvoice(contract, 23, bands).total).toBe(23.27)
    const invoice = estimateInvoice(contract, 23, bands, oneOffFees({ lines }))
    expect(invoice.fees.lines).toEqual([0.44, 0.61, 9.04])
    expect(invoice.taxes).toEqual([
      { pct: 0, base: 22.62, amount: 0 },
      { pct: 7, base: 9.65, amount: 0.68 },
    ])
    expect(invoice.total).toBe(32.95)
  })

  it('con el contrato que lee el lector de Endesa, cuadra con los 70,40 € facturados', () => {
    const contract = {
      ...endesaContract,
      discounts: [1.17, 3.9, 3.9].map((amount, i) => ({ label: `Descuento ${i + 1}`, type: 'amount', amount })),
    }
    expect(estimateInvoice(contract, 30, endesaKwhByBand).total).toBe(70.4)
  })
})
