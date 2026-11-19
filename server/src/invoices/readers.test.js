import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDisa } from './disa.js'
import { parseEndesa } from './endesa.js'
import { num, rowAmount } from './helpers.js'
import { parseInvoicePdf } from './index.js'

// Renglones sacados de dos facturas reales, sólo los que usan los lectores y sin datos personales
const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.rows.json`, import.meta.url), 'utf8'))

const row = (...items) => ({
  page: 1,
  y: 0,
  items: items.map((text, i) => ({ x: i * 100, text })),
  text: items.join(' '),
})

describe('cifras de una factura', () => {
  it('lee los números escritos a la española', () => {
    expect(num('18.273,356')).toBe(18273.356)
    expect(num('0,09990900')).toBe(0.099909)
  })

  it('saca el importe de un renglón, también el negativo y el guion que vale cero', () => {
    expect(rowAmount(row('Pot. P3 5,750 kW x 0,041554 Eur/kW x 30 días', '.......', '7,17 €'))).toBe(7.17)
    expect(rowAmount(row('Descuento fidelidad 39,01 Eur x -10 %', '-3,90 €'))).toBe(-3.9)
    expect(rowAmount(row('Impuesto IGIC (0,0', '%', ') al 22,62', '-', '€'))).toBe(0)
    expect(rowAmount(row('Término Potencia'))).toBeNull()
  })
})

describe('factura de Endesa', () => {
  const parsed = parseEndesa(fixture('endesa'))

  it('lee el periodo, el total y el consumo por tramo', () => {
    expect(parsed).toMatchObject({
      provider: 'endesa',
      from: '2026-08-04',
      to: '2026-09-03',
      days: 30,
      total: 70.4,
      kwh: 265.147,
      kwhByBand: { punta: 57.229, llano: 49.365, valle: 158.552 },
      warnings: [],
    })
  })

  it('deduce el contrato: precio fijo y dos términos de potencia', () => {
    expect(parsed.contract).toMatchObject({
      mode: 'fija',
      fixedPrice: 0.176956,
      power: {
        puntaLlano: { kw: 5.75, pricePerKwDay: 0.117686 },
        valle: { kw: 5.75, pricePerKwDay: 0.041554 },
      },
      electricityTaxPct: 5.1126963,
      supplyTaxPct: 0,
    })
    expect(parsed.contract.dailyFees).toEqual([
      { label: 'Financiación bono social', pricePerDay: 0.024688, inElectricityTaxBase: true, taxPct: 0 },
      { label: 'Alquiler del contador', pricePerDay: 0.02663, inElectricityTaxBase: false, taxPct: 7 },
    ])
  })

  it('guarda en euros los descuentos que sólo se aplican a parte del consumo', () => {
    expect(parsed.contract.discounts.map((discount) => discount.type === 'amount' && discount.amount)).toEqual([
      1.17, 3.9, 3.9,
    ])
    expect(parsed.contract.discounts[0].label).toBe('Descuento por servicio (3 % de parte del consumo)')
  })

  it('recoge cada concepto con su importe', () => {
    const amounts = (kind) => parsed.lines.filter((line) => line.kind === kind).map((line) => line.amount)
    expect(amounts('power')).toEqual([20.3, 7.17])
    expect(amounts('energy')).toEqual([39.01, 7.91])
    expect(amounts('discount')).toEqual([-1.17, -3.9, -3.9])
    expect(amounts('fee')).toEqual([0.74, 0.67, 0.13])
    expect(amounts('electricityTax')).toEqual([3.38])
    expect(amounts('tax')).toEqual([0, 0, 0.06])
    expect(amounts('adjustment')).toEqual([-5])
  })
})

describe('factura de DISA', () => {
  const parsed = parseDisa(fixture('disa'))

  it('lee el periodo, el total y el consumo por tramo', () => {
    expect(parsed).toMatchObject({
      provider: 'disa',
      from: '2026-08-28',
      to: '2026-09-19',
      days: 23,
      total: 32.95,
      kwh: 112.814,
      kwhByBand: { punta: 26.517, llano: 23.259, valle: 63.038 },
    })
  })

  it('deduce el contrato: mismo precio en los tres tramos y descuento en euros', () => {
    expect(parsed.contract).toMatchObject({
      mode: 'fija',
      fixedPrice: 0.109,
      power: { puntaLlano: { kw: 3, pricePerKwDay: 0.099909 }, valle: { kw: 3, pricePerKwDay: 0.099909 } },
      discounts: [{ label: 'Descuento Fidelización', type: 'amount', amount: 5 }],
      electricityTaxPct: 5.11269632,
      supplyTaxPct: 0,
    })
    expect(parsed.contract.dailyFees).toEqual([
      { label: 'Bono social', pricePerDay: 0.01913, inElectricityTaxBase: true, taxPct: 0 },
      { label: 'Alquiler del contador', pricePerDay: 0.026522, inElectricityTaxBase: false, taxPct: 7 },
    ])
  })

  it('separa el cargo que no se repite y avisa de él', () => {
    expect(parsed.lines.filter((line) => line.kind === 'oneoff')).toEqual([
      { kind: 'oneoff', label: 'Actuaciones en la medida', amount: 9.04, taxPct: 7 },
    ])
    expect(parsed.warnings).toHaveLength(1)
    expect(parsed.warnings[0]).toContain('Actuaciones en la medida')
  })

  it('lee el IGIC aunque el importe sea un guion', () => {
    expect(parsed.lines.filter((line) => line.kind === 'tax')).toEqual([
      { kind: 'tax', label: 'IGIC 0 %', amount: 0, taxPct: 0 },
      { kind: 'tax', label: 'IGIC 7 %', amount: 0.68, taxPct: 7 },
    ])
  })
})

// Las dos facturas siguientes son de meses en los que cambió la forma de una línea. Sus renglones están
// pasados a mano desde los PDF, con la misma colocación que los de arriba y sin datos personales.

describe('factura de Endesa de agosto, con la energía en una línea «Consumo …»', () => {
  const parsed = parseEndesa(fixture('endesa-2026-08'))

  it('lee el periodo, el total y el consumo por tramo', () => {
    expect(parsed).toMatchObject({
      provider: 'endesa',
      from: '2026-07-11',
      to: '2026-08-15',
      days: 35,
      total: 67.57,
      kwh: 194.586,
      kwhByBand: { punta: 65.27, llano: 43.387, valle: 85.929 },
      warnings: [],
    })
  })

  it('deduce el contrato: precio fijo, dos términos de potencia y sin descuentos', () => {
    expect(parsed.contract).toMatchObject({
      mode: 'fija',
      fixedPrice: 0.137172,
      power: {
        puntaLlano: { kw: 5.5, pricePerKwDay: 0.093986 },
        valle: { kw: 5.5, pricePerKwDay: 0.091881 },
      },
      discounts: [],
      electricityTaxPct: 5.1126963,
      supplyTaxPct: 0,
    })
    expect(parsed.contract.dailyFees).toEqual([
      { label: 'Financiación bono social', pricePerDay: 0.024688, inElectricityTaxBase: true, taxPct: 0 },
      { label: 'Alquiler del contador', pricePerDay: 0.02663, inElectricityTaxBase: false, taxPct: 7 },
    ])
  })

  it('recoge cada concepto con su importe, sin confundir «Consumo Total» con la energía', () => {
    const amounts = (kind) => parsed.lines.filter((line) => line.kind === kind).map((line) => line.amount)
    expect(amounts('power')).toEqual([18.09, 17.69])
    expect(amounts('energy')).toEqual([26.69])
    expect(amounts('discount')).toEqual([])
    expect(amounts('fee')).toEqual([0.86, 0.93])
    expect(amounts('electricityTax')).toEqual([3.24])
    expect(amounts('tax')).toEqual([0, 0, 0.07])
    expect(amounts('adjustment')).toEqual([-5])
  })
})

describe('factura de DISA de octubre, con los kWh sin decimales', () => {
  const parsed = parseDisa(fixture('disa-2026-10'))

  it('lee el periodo, el total y el consumo por tramo', () => {
    expect(parsed).toMatchObject({
      provider: 'disa',
      from: '2026-09-20',
      to: '2026-10-22',
      days: 33,
      total: 40.49,
      kwh: 158,
      kwhByBand: { punta: 36, llano: 34, valle: 88 },
      warnings: [],
    })
  })

  it('deduce el contrato: mismo precio en los tres tramos y sin descuentos', () => {
    expect(parsed.contract).toMatchObject({
      mode: 'fija',
      fixedPrice: 0.109,
      prices: { punta: 0.109, llano: 0.109, valle: 0.109 },
      power: { puntaLlano: { kw: 3, pricePerKwDay: 0.099909 }, valle: { kw: 3, pricePerKwDay: 0.099909 } },
      discounts: [],
      electricityTaxPct: 5.11269632,
      supplyTaxPct: 0,
    })
    expect(parsed.contract.dailyFees).toEqual([
      { label: 'Bono social', pricePerDay: 0.019091, inElectricityTaxBase: true, taxPct: 0 },
      { label: 'Alquiler del contador', pricePerDay: 0.026667, inElectricityTaxBase: false, taxPct: 7 },
    ])
  })

  it('recoge cada concepto con su importe', () => {
    const amounts = (kind) => parsed.lines.filter((line) => line.kind === kind).map((line) => line.amount)
    expect(amounts('power')).toEqual([9.89, 9.89])
    expect(amounts('energy')).toEqual([3.92, 3.71, 9.59])
    expect(amounts('fee')).toEqual([0.63, 0.88])
    expect(amounts('oneoff')).toEqual([])
    expect(amounts('electricityTax')).toEqual([1.92])
    expect(amounts('tax')).toEqual([0, 0.06])
  })
})

/** Los renglones de un fixture con el texto de algunos cambiado, como si la factura viniera así */
function withText(rows, replacements) {
  return rows.map((original) => {
    const replaced = replacements.find(([from]) => original.text.includes(from))
    if (!replaced) return original
    const [from, to] = replaced
    const items = original.items.map((item) => ({ ...item, text: item.text.replace(from, to) }))
    return { ...original, items, text: items.map((item) => item.text).join(' ') }
  })
}

describe('variaciones que no rompen el lector de Endesa', () => {
  it('acepta un periodo de un solo día', () => {
    const rows = withText(fixture('endesa'), [['a 03/09/2026 (30 días)', 'a 04/08/2026 (1 día)']])
    expect(parseEndesa(rows)).toMatchObject({ from: '2026-08-04', to: '2026-08-04', days: 1 })
  })

  it('con dos precios de energía en el periodo usa la media ponderada por los kWh y avisa', () => {
    const rows = withText(fixture('endesa'), [['44,717 kWh x 0,176956', '44,717 kWh x 0,200000']])
    const parsed = parseEndesa(rows)
    const expected = (220.43 * 0.176956 + 44.717 * 0.2) / (220.43 + 44.717)
    expect(parsed.contract.fixedPrice).toBeCloseTo(expected, 6)
    expect(parsed.contract.prices.valle).toBe(parsed.contract.fixedPrice)
    expect(parsed.warnings).toContain('La factura trae varios precios de energía; se ha usado el precio medio. Revisa el precio en el contrato.')
  })
})

/** Un PDF de una página en blanco, sin texto: como una factura escaneada */
function blankPdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, i) => {
    const offset = pdf.length
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`
    return offset
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

describe('un PDF que no es la factura esperada', () => {
  it('dice que parece escaneado si el PDF no trae texto', async () => {
    await expect(parseInvoicePdf(blankPdf(), 'endesa')).rejects.toMatchObject({ status: 422, code: 'scanned_pdf' })
  })

  it('dice qué dato falta si el texto no tiene la forma de la factura', () => {
    expect(() => parseEndesa([row('Hola')])).toThrow('el periodo de facturación')
    expect(() => parseDisa([row('Hola')])).toThrow('el periodo de consumo')
  })

  it('rechaza un archivo que no es un PDF', async () => {
    await expect(parseInvoicePdf(new TextEncoder().encode('no soy un pdf'), 'endesa')).rejects.toMatchObject({
      status: 422,
      code: 'not_a_pdf',
    })
  })
})

// Con los PDF reales en la carpeta del proyecto se comprueba además la lectura de principio a fin.
// No están en el repositorio: llevan datos personales.
const endesaPdf = new URL('../../../factura_endesa.pdf', import.meta.url)
const disaPdf = new URL('../../../factura_disa.pdf', import.meta.url)
const disaPassword = process.env.DISA_PDF_PASSWORD

describe.skipIf(!existsSync(endesaPdf))('PDF real de Endesa', () => {
  const data = () => new Uint8Array(readFileSync(endesaPdf))

  it('se lee entero y da lo mismo que los renglones guardados', async () => {
    const parsed = await parseInvoicePdf(data(), 'endesa')
    expect(parsed).toEqual(parseEndesa(fixture('endesa')))
  })

  it('avisa si se elige otra comercializadora', async () => {
    await expect(parseInvoicePdf(data(), 'disa')).rejects.toMatchObject({ status: 422, code: 'provider_is_endesa' })
  })
})

describe.skipIf(!existsSync(disaPdf))('PDF real de DISA, protegido con contraseña', () => {
  const data = () => new Uint8Array(readFileSync(disaPdf))

  it('pide la contraseña y rechaza una incorrecta', async () => {
    await expect(parseInvoicePdf(data(), 'disa')).rejects.toMatchObject({ code: 'password_needed' })
    await expect(parseInvoicePdf(data(), 'disa', 'no-es-esta')).rejects.toMatchObject({ code: 'password_incorrect' })
  })

  it.skipIf(!disaPassword)('con la contraseña se lee entero y da lo mismo que los renglones guardados', async () => {
    const parsed = await parseInvoicePdf(data(), 'disa', disaPassword)
    expect(parsed).toEqual(parseDisa(fixture('disa')))
  })
})
