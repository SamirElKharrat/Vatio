// Letra de control del DNI y del NIE: el resto de dividir el número entre 23 dice cuál toca
const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const NIE_PREFIX = { X: '0', Y: '1', Z: '2' }

/** «12345678-z» → «12345678Z»: sin espacios ni guiones y en mayúsculas */
export const normalizeDni = (value) => String(value ?? '').replace(/[\s-]/g, '').toUpperCase()

/** ¿Es un DNI (8 cifras y letra) o un NIE (X, Y o Z, 7 cifras y letra) con la letra que le toca? */
export function isValidDni(value) {
  const dni = normalizeDni(value)
  const match = /^([XYZ]\d{7}|\d{8})([A-Z])$/.exec(dni)
  if (!match) return false
  const number = Number(match[1].replace(/^[XYZ]/, (letter) => NIE_PREFIX[letter]))
  return LETTERS[number % 23] === match[2]
}
