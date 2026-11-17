// Los importes de dos facturas reales, sin datos personales. Sirven para comprobar
// que la fórmula reproduce al céntimo lo que cobra cada comercializadora.
import { dailyAmount } from '../invoice'

/** Endesa «Tu Luz», del 04/08/2026 al 03/09/2026 (30 días). Total 70,40 €; a pagar 65,40 €. */
export const endesa = {
  power: [
    { label: 'Pot. Punta-Llano', kw: 5.75, pricePerKwDay: 0.117686, days: 30 },
    { label: 'Pot. P3', kw: 5.75, pricePerKwDay: 0.041554, days: 30 },
  ],
  energy: [
    { label: 'Facturación del consumo', kwh: 220.43, price: 0.176956 },
    { label: 'Facturación del consumo', kwh: 44.717, price: 0.176956 },
  ],
  // Los tres descuentos se aplican sólo a la primera línea de consumo
  discounts: [
    { label: 'Descuento por servicio', type: 'percent', pct: 3, onEnergyLines: [0] },
    { label: 'Descuento fidelidad', type: 'percent', pct: 10, onEnergyLines: [0] },
    { label: 'Descuento promocional', type: 'percent', pct: 10, onEnergyLines: [0] },
  ],
  fees: [
    { label: 'Financiación bono social', amount: dailyAmount(30, 0.024688), inElectricityTaxBase: true, taxPct: 0 },
    { label: 'Alquiler del contador', amount: dailyAmount(25, 0.02663), inElectricityTaxBase: false, taxPct: 7 },
    { label: 'Alquiler del contador', amount: dailyAmount(5, 0.02663), inElectricityTaxBase: false, taxPct: 7 },
  ],
  electricityTaxPct: 5.1126963,
  supplyTaxPct: 0,
  afterTotal: [{ label: 'PARA TI', amount: -5 }],
}

/** El mismo contrato de Endesa, como lo guardaría la app */
export const endesaContract = {
  mode: 'fija',
  fixedPrice: 0.176956,
  prices: { valle: 0.176956, llano: 0.176956, punta: 0.176956 },
  power: {
    puntaLlano: { kw: 5.75, pricePerKwDay: 0.117686 },
    valle: { kw: 5.75, pricePerKwDay: 0.041554 },
  },
  discounts: [],
  dailyFees: [
    { label: 'Financiación bono social', pricePerDay: 0.024688, inElectricityTaxBase: true, taxPct: 0 },
    { label: 'Alquiler del contador', pricePerDay: 0.02663, inElectricityTaxBase: false, taxPct: 7 },
  ],
  electricityTaxPct: 5.1126963,
  supplyTaxPct: 0,
}

/** Consumo medido por tramo en esa factura de Endesa */
export const endesaKwhByBand = { punta: 57.229, llano: 49.365, valle: 158.552 }

/** DISA, del 28/08/2026 al 19/09/2026 (23 días). Total 32,95 €. */
export const disa = {
  power: [
    { label: 'P1', kw: 3, pricePerKwDay: 0.099909, days: 23 },
    { label: 'P3', kw: 3, pricePerKwDay: 0.099909, days: 23 },
  ],
  energy: [
    { label: 'P1', kwh: 26.517, price: 0.109 },
    { label: 'P2', kwh: 23.259, price: 0.109 },
    { label: 'P3', kwh: 63.038, price: 0.109 },
  ],
  discounts: [{ label: 'Descuento fidelización', type: 'amount', amount: 5 }],
  fees: [
    { label: 'Bono social', amount: 0.44, inElectricityTaxBase: true, taxPct: 0 },
    { label: 'Actuaciones en la medida', amount: 9.04, inElectricityTaxBase: false, taxPct: 7 },
    { label: 'Alquiler equipo distribuidora', amount: 0.61, inElectricityTaxBase: false, taxPct: 7 },
  ],
  electricityTaxPct: 5.11269632,
  supplyTaxPct: 0,
}
