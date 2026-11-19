import { describe, expect, it } from 'vitest'
import { asksDni, asksPassword, breakdown, importStep } from './importFlow'

const file = { name: 'factura.pdf' }
const fail = (code) => Object.assign(new Error('fallo'), { code })

describe('pasos del diálogo de subir una factura', () => {
  it('pide primero la comercializadora y después el PDF', () => {
    expect(importStep({ provider: null }).name).toBe('pickProvider')
    expect(importStep({ provider: 'disa' }).name).toBe('pickFile')
  })

  it('mientras lee no enseña errores anteriores', () => {
    expect(importStep({ provider: 'disa', file, reading: true, error: fail('password_needed') }).name).toBe('reading')
  })

  it('con lo leído pasa a revisarlo', () => {
    const parsed = { total: 32.95 }
    expect(importStep({ provider: 'disa', file, parsed })).toEqual({ name: 'review', parsed })
  })

  it('distingue cada fallo por su clave', () => {
    const step = (code) => importStep({ provider: 'disa', file, error: fail(code) })
    expect(step('password_needed').name).toBe('needsPassword')
    expect(step('password_incorrect').name).toBe('wrongPassword')
    expect(step('provider_is_endesa')).toEqual({ name: 'wrongProvider', detected: 'endesa' })
    expect(step('not_a_pdf').name).toBe('failed')
    expect(step(undefined).name).toBe('failed')
  })

  it('pide la contraseña cuando falta y cuando no es la buena', () => {
    expect(asksPassword({ name: 'needsPassword' }, 'endesa')).toBe(true)
    expect(asksPassword({ name: 'wrongPassword' }, 'endesa')).toBe(true)
    expect(asksPassword({ name: 'failed' }, 'endesa')).toBe(false)
  })

  it('con DISA pide el DNI antes de subir el PDF y no una contraseña genérica', () => {
    expect(asksDni({ name: 'pickFile' }, 'disa')).toBe(true)
    expect(asksDni({ name: 'wrongPassword' }, 'disa')).toBe(true)
    expect(asksDni({ name: 'reading' }, 'disa')).toBe(false)
    expect(asksDni({ name: 'review' }, 'disa')).toBe(false)
    expect(asksDni({ name: 'pickFile' }, 'endesa')).toBe(false)
    expect(asksPassword({ name: 'wrongPassword' }, 'disa')).toBe(false)
  })

  it('si no cuadra, señala en qué concepto está la diferencia', () => {
    const parsed = {
      lines: [
        { kind: 'power', amount: 9.89 },
        { kind: 'power', amount: 9.89 },
        { kind: 'energy', amount: 17.22 },
        { kind: 'discount', amount: -5 },
        { kind: 'fee', amount: 0.63 },
        { kind: 'oneoff', amount: 9.04 },
        { kind: 'electricityTax', amount: 1.92 },
        { kind: 'tax', amount: 0.06 },
      ],
    }
    const rebuilt = {
      power: { total: 19.78 },
      energy: { total: 17.22 },
      discounts: { total: 0 },
      fees: { total: 9.67 },
      electricityTax: { amount: 1.92 },
      taxTotal: 0.06,
    }
    const rows = breakdown(parsed, rebuilt)
    expect(rows.filter((row) => row.differs).map((row) => row.label)).toEqual(['Descuentos'])
    expect(rows.find((row) => row.label === 'Descuentos')).toMatchObject({ read: 5, rebuilt: 0 })
  })

  it('si el servidor dice que falta el DNI, lo vuelve a pedir', () => {
    expect(importStep({ provider: 'disa', file, error: fail('dni_needed') }).name).toBe('needsPassword')
  })
})
