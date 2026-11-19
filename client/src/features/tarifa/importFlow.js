/**
 * Paso en el que está el diálogo de subir una factura. Se deduce de lo elegido y del estado de la
 * lectura (la mutación `useParseInvoice`); no se guarda aparte, así que no se puede desincronizar.
 *
 *   pickProvider ─elige─▶ pickFile ─sube el PDF─▶ reading ─┬─▶ review
 *                                                          ├─▶ needsPassword ─contraseña─▶ reading
 *                                                          ├─▶ wrongPassword ─contraseña─▶ reading
 *                                                          ├─▶ wrongProvider ─«Leer como…»─▶ reading
 *                                                          └─▶ failed
 *
 * Desde cualquier paso de error, elegir otra comercializadora vuelve a `pickFile`;
 * «Descartar» en `review` también. El nombre del paso sale en `data-step` del diálogo.
 */
export function importStep({ provider, file, reading, parsed, error }) {
  if (reading) return { name: 'reading' }
  if (parsed && file) return { name: 'review', parsed }
  if (error) {
    // El servidor explica el fallo con una clave (`code`): ver server/src/invoices/index.js
    const code = error.code ?? null
    if (code === 'password_needed' || code === 'dni_needed') return { name: 'needsPassword' }
    if (code === 'password_incorrect') return { name: 'wrongPassword' }
    if (code?.startsWith(PROVIDER_IS)) return { name: 'wrongProvider', detected: code.slice(PROVIDER_IS.length) }
    return { name: 'failed' }
  }
  return { name: provider ? 'pickFile' : 'pickProvider' }
}

const PROVIDER_IS = 'provider_is_'

const PASSWORD_STEPS = ['needsPassword', 'wrongPassword']

/**
 * ¿Hay que pedir una contraseña para abrir el PDF en este paso? Las facturas de DISA se abren
 * con el DNI del titular, que tiene su propio campo (`asksDni`).
 */
export const asksPassword = (step, provider) => provider !== 'disa' && PASSWORD_STEPS.includes(step.name)

/** ¿Hay que pedir el DNI? Con DISA, antes de subir el PDF y otra vez si el que se dio no lo abre */
export const asksDni = (step, provider) => provider === 'disa' && ['pickFile', ...PASSWORD_STEPS].includes(step.name)

/**
 * Cuando el total rehecho no cuadra: cada concepto tal como viene en la factura y tal como sale
 * al rehacerla con los datos leídos (`estimateInvoice`), para ver dónde está la diferencia
 */
export function breakdown(parsed, rebuilt) {
  const sumOf = (...kinds) =>
    parsed.lines.filter((line) => kinds.includes(line.kind)).reduce((total, line) => total + line.amount, 0)
  return [
    { label: 'Potencia', read: sumOf('power'), rebuilt: rebuilt.power.total },
    { label: 'Energía', read: sumOf('energy'), rebuilt: rebuilt.energy.total },
    { label: 'Descuentos', read: -sumOf('discount'), rebuilt: rebuilt.discounts.total },
    { label: 'Bono social, alquiler y otros cargos', read: sumOf('fee', 'oneoff'), rebuilt: rebuilt.fees.total },
    { label: 'Impuesto eléctrico', read: sumOf('electricityTax'), rebuilt: rebuilt.electricityTax.amount },
    { label: 'IGIC o IVA', read: sumOf('tax'), rebuilt: rebuilt.taxTotal },
  ].map((row) => ({ ...row, differs: Math.abs(row.read - row.rebuilt) >= 0.005 }))
}
