/** Comercializadoras con nombre propio en la app; el resto va como «Otra» */
export const PROVIDERS = [
  { id: 'endesa', name: 'Endesa' },
  { id: 'disa', name: 'DISA' },
]

export const providerName = (id) =>
  PROVIDERS.find((provider) => provider.id === id)?.name ?? null
