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
    if (code === 'password_needed') return { name: 'needsPassword' }
    if (code === 'password_incorrect') return { name: 'wrongPassword' }
    if (code?.startsWith(PROVIDER_IS)) return { name: 'wrongProvider', detected: code.slice(PROVIDER_IS.length) }
    return { name: 'failed' }
  }
  return { name: provider ? 'pickFile' : 'pickProvider' }
}

const PROVIDER_IS = 'provider_is_'

/** ¿Hay que pedir la contraseña del PDF en este paso? */
export const asksPassword = (step) => step.name === 'needsPassword' || step.name === 'wrongPassword'
