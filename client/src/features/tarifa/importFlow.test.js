import { describe, expect, it } from 'vitest'
import { asksPassword, importStep } from './importFlow'

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
    expect(asksPassword({ name: 'needsPassword' })).toBe(true)
    expect(asksPassword({ name: 'wrongPassword' })).toBe(true)
    expect(asksPassword({ name: 'failed' })).toBe(false)
  })
})
