/**
 * Guarda un dato delicado (el DNI que abre una factura) para entregarlo una sola vez.
 * Al sacarlo con `take()` el contenedor se queda vacío, así que lo que guarde una referencia a él
 * después (por ejemplo, las variables de una mutación de TanStack Query) ya no tiene el dato.
 */
export function oneTimeSecret(value) {
  let secret = value
  return {
    take() {
      const taken = secret
      secret = undefined
      return taken
    },
    // Si alguien lo serializa (herramientas de depuración, registros), no sale el dato
    toJSON: () => '[oculto]',
    toString: () => '[oculto]',
  }
}
