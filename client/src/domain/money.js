/** Redondea a céntimos como en una factura: 0,6755 → 0,68 aunque el binario lo deje en 0,67549… */
export function roundCents(amount) {
  const sign = amount < 0 ? -1 : 1
  return (sign * Math.round(Math.abs(amount) * 100 + 1e-7)) / 100
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}
