/** Todos los aparatos comparten claridad y saturación; sólo cambia el tono */
export const deviceColor = (hue) => `oklch(0.63 0.125 ${hue})`
export const deviceColorSoft = (hue) => `oklch(0.63 0.125 ${hue} / 0.45)`
export const deviceBorder = (hue) => `oklch(0.52 0.12 ${hue})`
/** Tinta del mismo tono, para escribir sobre el color suave de las rutinas */
export const deviceInk = (hue) => `oklch(0.36 0.09 ${hue})`

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
