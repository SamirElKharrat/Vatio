/** Parte la cifra y su unidad («15,10 kWh» → «15,10» + «kWh») para poder rebajar la unidad */
export function splitUnit(value) {
  const match = typeof value === 'string' ? value.match(/^(.*\d)\s+(\D+)$/) : null
  return match ? [match[1], match[2]] : [value, null]
}
