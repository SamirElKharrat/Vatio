import { describe, expect, it } from 'vitest'
import { isValidDni, normalizeDni } from './dni'
import { oneTimeSecret } from './oneTimeSecret'

describe('DNI y NIE', () => {
  it('quita espacios y guiones y pasa a mayúsculas', () => {
    expect(normalizeDni(' 12345678-z ')).toBe('12345678Z')
  })

  it('acepta DNI y NIE con su letra de control', () => {
    expect(isValidDni('12345678Z')).toBe(true)
    expect(isValidDni('12345678 z')).toBe(true)
    expect(isValidDni('X1234567L')).toBe(true)
  })

  it('rechaza la letra equivocada y las formas que no son de DNI ni NIE', () => {
    expect(isValidDni('12345678A')).toBe(false)
    expect(isValidDni('1234567Z')).toBe(false)
    expect(isValidDni('')).toBe(false)
  })
})

describe('dato de un solo uso', () => {
  it('se entrega una vez y después queda vacío', () => {
    const secret = oneTimeSecret('12345678Z')
    expect(secret.take()).toBe('12345678Z')
    expect(secret.take()).toBeUndefined()
  })

  it('no sale al serializarlo', () => {
    const variables = { provider: 'disa', secret: oneTimeSecret('12345678Z') }
    expect(JSON.stringify(variables)).not.toContain('12345678Z')
    expect(String(variables.secret)).not.toContain('12345678Z')
  })
})
