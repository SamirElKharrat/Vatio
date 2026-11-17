/** Falta un dato imprescindible: la factura no tiene la forma que el lector espera */
export class InvoiceFormatError extends Error {
  constructor(missing) {
    super(`No se ha encontrado en la factura: ${missing}`)
  }
}
