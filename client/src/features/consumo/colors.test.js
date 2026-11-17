import { describe, expect, it } from 'vitest'
import { deviceColor, deviceColorSoft, deviceText } from './colors'

describe('colores de los aparatos', () => {
  it('usa el color guardado y deriva los demás de él', () => {
    expect(deviceColor('#499e5f')).toBe('#499e5f')
    expect(deviceColorSoft('#499e5f')).toBe('#499e5f73')
    expect(deviceText('#202020')).toBe('white')
  })

  it('si el aparato llega sin color válido, pinta gris en vez de fallar', () => {
    for (const bad of [undefined, null, 150, 'rojo']) {
      expect(deviceColor(bad)).toBe('#8a8178')
      expect(() => deviceText(bad)).not.toThrow()
    }
  })
})
