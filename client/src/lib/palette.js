// Colores de aparatos y consumos fijos. Se guardan en hexadecimal (#rrggbb); la paleta se genera en OKLCH
// para que cada fila suba de oscuro a claro de forma pareja y las filas se distingan entre sí.

const toSrgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)

/** OKLCH → sRGB lineal → sRGB, sin recortar */
function oklchToRgb(l, c, h) {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    toSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    toSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    toSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ]
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005)

/** Color OKLCH en hexadecimal; si la saturación pedida no cabe en la pantalla, se rebaja hasta que quepa */
export function oklchToHex(l, c, h) {
  let rgb = oklchToRgb(l, c, h)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = c
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToRgb(l, mid, h))) lo = mid
      else hi = mid
    }
    rgb = oklchToRgb(l, lo, h)
  }
  return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')
}

/** Luminancia relativa (WCAG) de un #rrggbb */
export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Claridades de las seis columnas, de oscuro a claro */
const LIGHTNESS = [0.38, 0.48, 0.58, 0.68, 0.78, 0.88]
const VIVID = 0.32 // se recorta al máximo que admite cada matiz y claridad
const SOFT = 0.09

const row = (h, c) => LIGHTNESS.map((l) => oklchToHex(l, c, h))
/** Cinco matices separados 12°, cada uno en versión viva y suave */
const family = (hues) => hues.flatMap((h) => [row(h, VIVID), row(h, SOFT)])

/** Páginas del selector grande: una por familia, cada fila un color de oscuro a claro */
export const COLOR_FAMILIES = [
  { name: 'Rojos', rows: family([5, 17, 29, 41, 53]) },
  { name: 'Naranjas y amarillos', rows: family([65, 77, 89, 101, 113]) },
  { name: 'Verdes', rows: family([125, 137, 149, 161, 173]) },
  { name: 'Turquesas', rows: family([185, 197, 209, 221, 233]) },
  { name: 'Azules y violetas', rows: family([245, 257, 269, 281, 293]) },
  { name: 'Morados y rosas', rows: family([305, 317, 329, 341, 353]) },
  {
    name: 'Neutros',
    rows: [
      row(0, 0),
      row(60, 0.015),
      row(70, 0.035),
      row(55, 0.06),
      row(85, 0.05),
      row(250, 0.02),
      row(250, 0.045),
      row(150, 0.03),
      row(310, 0.03),
      row(10, 0.035),
    ],
  },
]

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** Página del selector donde está un color o, si no está en la paleta, la de su color más parecido */
export function familyOf(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color ?? '')) return 0
  const target = rgbOf(color)
  let best = { family: 0, distance: Infinity }
  COLOR_FAMILIES.forEach((family, index) => {
    for (const swatch of family.rows.flat()) {
      const distance = rgbOf(swatch).reduce((sum, v, i) => sum + (v - target[i]) ** 2, 0)
      if (distance < best.distance) best = { family: index, distance }
    }
  })
  return best.family
}

/** Colores de acceso rápido en el formulario: los doce de siempre, bien distintos entre sí (los mismos que deja la migración 004) */
export const PRESETS = [
  '#499e5f', '#009ead', '#c96b53', '#bc7728', '#6486d5', '#af6db3',
  '#8e8f23', '#c56686', '#00a18c', '#2094c9', '#8f78cc', '#ac8211',
]

/** Primer color rápido que aún no usa ningún elemento */
export const firstFreeColor = (used) => PRESETS.find((color) => !used.includes(color)) ?? PRESETS[0]
