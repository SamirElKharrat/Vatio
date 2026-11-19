export const eur = (amount) => amount.toFixed(2).replace('.', ',') + ' €'

/**
 * Importe calculado con el contrato y lo apuntado: nunca es exacto como el de la factura, así que
 * se pinta con «≈». Lo que viene de una factura real (su total, sus líneas) va con `eur`.
 */
export const approxEur = (amount) => '≈ ' + eur(amount)

/** Aviso fijo al pie de las pantallas con importes calculados */
export const ESTIMATE_NOTE =
  'Los importes son estimaciones con tu contrato y lo que apuntas. La factura final puede variar.'

export const kwh = (amount, decimals = 2) => amount.toFixed(decimals).replace('.', ',') + ' kWh'
