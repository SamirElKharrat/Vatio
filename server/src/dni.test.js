import { describe, expect, it } from 'vitest'
import { isValidDni, normalizeDni } from './dni.js'

describe('DNI y NIE', () => {
  it('quita espacios y guiones y pasa a mayúsculas', () => {
    expect(normalizeDni(' 12345678-z ')).toBe('12345678Z')
  })

  it('acepta un DNI con su letra de control', () => {
    expect(isValidDni('12345678Z')).toBe(true)
    expect(isValidDni('00000000t')).toBe(true)
  })

  it('acepta un NIE con su letra de control', () => {
    expect(isValidDni('X1234567L')).toBe(true)
    expect(isValidDni('Y-0000000-Z')).toBe(true)
  })

  it('rechaza la letra equivocada y las formas que no son de DNI ni NIE', () => {
    expect(isValidDni('12345678A')).toBe(false)
    expect(isValidDni('1234567Z')).toBe(false)
    expect(isValidDni('A1234567L')).toBe(false)
    expect(isValidDni('')).toBe(false)
    expect(isValidDni(undefined)).toBe(false)
  })
})
