import { luminance } from '../../lib/palette'

// El color de cada aparato es un #rrggbb; los demás se derivan de él

export const deviceColor = (color) => color
/** Versión translúcida, para las rutinas */
export const deviceColorSoft = (color) => `${color}73`
export const deviceBorder = (color) => `color-mix(in oklab, ${color} 82%, black)`
/** Tinta del mismo color, para escribir sobre el color suave de las rutinas */
export const deviceInk = (color) => `color-mix(in oklab, ${color} 42%, black)`
/** Texto legible sobre el color sólido: blanco, salvo en los colores claros, donde va una tinta oscura del mismo color */
export const deviceText = (color) => (luminance(color) > 0.3 ? `color-mix(in oklab, ${color} 32%, black)` : 'white')

export const BAND_NAME = { valle: 'Valle', llano: 'Llano', punta: 'Punta' }
export const BAND_BG = { valle: 'bg-valle', llano: 'bg-llano', punta: 'bg-punta' }
export const BAND_SOFT = {
  valle: 'bg-valle-soft',
  llano: 'bg-llano-soft',
  punta: 'bg-punta-soft',
}

/** Color de una celda de la semana según su consumo: `t` va de 0 (poco) a 1 (el máximo de la semana) */
export const weekHeat = (t) => `oklch(${(0.92 - 0.42 * t).toFixed(3)} ${(0.04 + 0.11 * t).toFixed(3)} 45)`

/** Color de una casilla del mes; más suave, porque lleva texto encima */
export const monthHeat = (t) => `oklch(${(0.972 - 0.17 * t).toFixed(3)} ${(0.016 + 0.094 * t).toFixed(3)} 50)`
