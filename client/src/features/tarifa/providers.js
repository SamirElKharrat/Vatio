/** Comercializadoras con nombre propio en la app; el resto va como «Otra» */
export const PROVIDERS = [
  { id: 'endesa', name: 'Endesa' },
  { id: 'disa', name: 'DISA' },
]

export const providerName = (id) =>
  PROVIDERS.find((provider) => provider.id === id)?.name ?? null

/**
 * Cómo se llama la comercializadora del contrato: la conocida por su nombre propio y, si es «Otra»,
 * el nombre que se haya escrito. `null` si no hay ninguna.
 */
export const providerLabel = (provider) => providerName(provider) ?? (provider?.trim() || null)
