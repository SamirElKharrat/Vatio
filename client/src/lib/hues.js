// Tonos repartidos por el círculo de color; todos comparten la claridad y la saturación del diseño
export const HUES = [150, 205, 35, 65, 265, 325, 110, 0, 180, 235, 295, 85]

/** Primer tono de la paleta que aún no usa ningún elemento */
export const firstFreeHue = (used) => HUES.find((hue) => !used.includes(hue)) ?? HUES[0]
