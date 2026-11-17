import { describe, expect, it } from 'vitest'
import { COLOR_FAMILIES, familyOf, firstFreeColor, oklchToHex, PRESETS } from './palette'

describe('paleta de colores', () => {
  it('convierte OKLCH a hexadecimal', () => {
    expect(oklchToHex(0, 0, 0)).toBe('#000000')
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff')
    expect(oklchToHex(0.63, 0.125, 150)).toBe(PRESETS[0])
  })

  it('genera siete familias de filas de seis colores válidos, de oscuro a claro', () => {
    expect(COLOR_FAMILIES).toHaveLength(7)
    for (const family of COLOR_FAMILIES) {
      for (const row of family.rows) {
        expect(row).toHaveLength(6)
        for (const color of row) expect(color).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('abre la paleta en la familia del color, aunque no esté exactamente en ella', () => {
    const blue = COLOR_FAMILIES[4].rows[2][3]
    expect(familyOf(blue)).toBe(4)
    expect(COLOR_FAMILIES[familyOf('#499e5f')].name).toBe('Verdes')
    expect(familyOf(undefined)).toBe(0)
  })

  it('propone el primer color rápido libre', () => {
    expect(firstFreeColor([])).toBe(PRESETS[0])
    expect(firstFreeColor([PRESETS[0], PRESETS[1]])).toBe(PRESETS[2])
  })
})
