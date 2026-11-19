import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api, ApiError } from './client'

export const keys = {
  me: ['me'],
  devices: ['devices'],
  fixedLoads: ['fixedLoads'],
  routines: ['routines'],
  contract: ['contract'],
  usages: (from, to) => ['usages', from, to],
  invoices: ['invoices'],
  users: ['users'],
}

// Sesión

/** La cuenta que ha entrado, o `null` si no hay sesión */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return (await api('/auth/me')).user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: Infinity,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials) =>
      api('/auth/login', { method: 'POST', body: credentials }),
    onSuccess: ({ user }) => {
      // Nada de lo que hubiera en caché de otra cuenta debe sobrevivir
      queryClient.clear()
      queryClient.setQueryData(keys.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear()
      queryClient.setQueryData(keys.me, null)
    },
  })
}

/** Cambiar el nombre o el correo de la propia cuenta; para el correo hace falta `currentPassword` */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes) => api('/auth/me', { method: 'PATCH', body: changes }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(keys.me, user)
      // El administrador ve su cuenta también en la lista de cuentas
      queryClient.invalidateQueries({ queryKey: keys.users })
    },
  })
}

/** Cambiar la contraseña de la propia cuenta; las demás sesiones abiertas se cierran */
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      api('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } }),
  })
}

// Datos de la casa

const useDevices = () =>
  useQuery({ queryKey: keys.devices, queryFn: async () => (await api('/devices')).devices })

const useFixedLoads = () =>
  useQuery({
    queryKey: keys.fixedLoads,
    queryFn: async () => (await api('/fixed-loads')).fixedLoads,
  })

const useRoutines = () =>
  useQuery({ queryKey: keys.routines, queryFn: async () => (await api('/routines')).routines })

export const useContract = () =>
  useQuery({ queryKey: keys.contract, queryFn: async () => (await api('/contract')).contract })

const useUsages = (from, to) =>
  useQuery({
    queryKey: keys.usages(from, to),
    queryFn: async () => (await api(`/usages?from=${from}&to=${to}`)).usages,
    // Al pasar de semana o de mes se mantiene la pantalla en vez de volver a «Cargando…»
    placeholderData: keepPreviousData,
  })

/** Todo lo que necesita la lógica de cálculo para un rango de fechas */
export function useHousehold(from, to) {
  const devices = useDevices()
  const fixedLoads = useFixedLoads()
  const routines = useRoutines()
  const contract = useContract()
  const usages = useUsages(from, to)
  const queries = [devices, fixedLoads, routines, contract, usages]

  const home =
    devices.data && fixedLoads.data && routines.data && contract.data && usages.data
      ? {
          devices: devices.data,
          fixedLoads: fixedLoads.data,
          routines: routines.data,
          contract: contract.data,
          usages: usages.data,
        }
      : undefined

  return {
    home,
    isPending: queries.some((query) => query.isPending),
    error: queries.find((query) => query.error)?.error ?? null,
    refetch: () => queries.forEach((query) => query.error && query.refetch()),
  }
}

// Usos

const USAGES_KEY = ['usages']

/** Aplica un cambio a todos los rangos de usos que hay en caché (la semana, el mes…) */
function patchUsages(queryClient, update) {
  for (const [key, usages] of queryClient.getQueriesData({ queryKey: USAGES_KEY })) {
    if (usages) queryClient.setQueryData(key, update(usages, key[1], key[2]))
  }
}

const restoreUsages = (queryClient, snapshot) =>
  snapshot.forEach(([key, usages]) => queryClient.setQueryData(key, usages))

export function useCreateUsage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (usage) => (await api('/usages', { method: 'POST', body: usage })).usage,
    onSuccess: (usage) =>
      patchUsages(queryClient, (usages, from, to) =>
        usage.date >= from && usage.date <= to ? [...usages, usage] : usages,
      ),
  })
}

/**
 * Cambia un uso. La pantalla se actualiza antes de que responda el servidor, para que
 * soltar un bloque no dé un salto atrás; si el servidor lo rechaza, se deshace.
 */
export function useUpdateUsage() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ id, changes }) =>
      (await api(`/usages/${id}`, { method: 'PATCH', body: changes })).usage,
    onError: (_error, { snapshot }) => restoreUsages(queryClient, snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: USAGES_KEY }),
  })

  function update(id, changes, options) {
    const snapshot = queryClient.getQueriesData({ queryKey: USAGES_KEY })
    patchUsages(queryClient, (usages) => usages.map((usage) => (usage.id === id ? { ...usage, ...changes } : usage)))
    mutation.mutate({ id, changes, snapshot }, options)
  }

  return { update, error: mutation.error, isPending: mutation.isPending, reset: mutation.reset }
}

export function useDeleteUsage() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id }) => api(`/usages/${id}`, { method: 'DELETE' }),
    onError: (_error, { snapshot }) => restoreUsages(queryClient, snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: USAGES_KEY }),
  })

  function remove(id) {
    const snapshot = queryClient.getQueriesData({ queryKey: USAGES_KEY })
    patchUsages(queryClient, (usages) => usages.filter((usage) => usage.id !== id))
    mutation.mutate({ id, snapshot })
  }

  return { remove, error: mutation.error, reset: mutation.reset }
}

// Rutinas: saltar un día y pausar

function useRoutineMutation(request) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: ({ routine }) =>
      queryClient.setQueryData(keys.routines, (routines) =>
        routines?.map((current) => (current.id === routine.id ? routine : current)),
      ),
  })
}

/** «Saltar hoy»: quita o repone la rutina sólo en esa fecha */
export const useSkipRoutine = () =>
  useRoutineMutation(({ id, date, skip }) =>
    api(`/routines/${id}/skips/${date}`, { method: skip ? 'PUT' : 'DELETE' }),
  )

/** «Pausar desde hoy»: con `null` la reanuda */
export const usePauseRoutine = () =>
  useRoutineMutation(({ id, pausedFrom }) =>
    api(`/routines/${id}`, { method: 'PATCH', body: { pausedFrom } }),
  )

/** «Cambiar este día» o «esta semana»: en esas fechas la rutina deja paso a usos apuntados con otras horas */
export function useOverrideRoutine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dates, start, hours }) =>
      api(`/routines/${id}/overrides`, { method: 'POST', body: { dates, start, hours } }),
    onSuccess: ({ routine, usages }) => {
      queryClient.setQueryData(keys.routines, (routines) =>
        routines?.map((current) => (current.id === routine.id ? routine : current)),
      )
      patchUsages(queryClient, (cached, from, to) => [
        ...cached,
        ...usages.filter((usage) => usage.date >= from && usage.date <= to),
      ])
    },
  })
}

// Aparatos, consumos fijos y rutinas

const SAVE_DELAY_MS = 500

/**
 * Cambios escritos en línea, como los vatios de una tabla: la pantalla se recalcula con cada
 * tecla y el guardado espera a que se deje de escribir. Si el servidor lo rechaza, se recarga.
 */
function useInlineUpdate(queryKey, path) {
  const queryClient = useQueryClient()
  const pending = useRef(new Map())
  const [error, setError] = useState(null)

  function update(id, changes) {
    queryClient.setQueryData(queryKey, (items) =>
      items?.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    )
    const previous = pending.current.get(id)
    if (previous) clearTimeout(previous.timer)
    const merged = { ...previous?.changes, ...changes }

    const timer = setTimeout(async () => {
      pending.current.delete(id)
      try {
        await api(`${path}/${id}`, { method: 'PATCH', body: merged })
        setError(null)
      } catch (failure) {
        setError(failure)
        queryClient.invalidateQueries({ queryKey })
      }
    }, SAVE_DELAY_MS)
    pending.current.set(id, { timer, changes: merged })
  }

  return { update, error, clearError: () => setError(null) }
}

/** Alta, cambio completo y baja de los elementos de una lista en caché */
function useListCrud(
  queryKey,
  path,
  field,
  /** Cachés que dependen de esta lista y hay que recargar al borrar */
  dependents = [],
) {
  const queryClient = useQueryClient()
  const unwrap = (data) => data[field]

  const create = useMutation({
    mutationFn: async (input) => unwrap(await api(path, { method: 'POST', body: input })),
    onSuccess: (item) => queryClient.setQueryData(queryKey, (items) => [...(items ?? []), item]),
  })
  const save = useMutation({
    mutationFn: async ({ id, changes }) =>
      unwrap(await api(`${path}/${id}`, { method: 'PATCH', body: changes })),
    onSuccess: (item) =>
      queryClient.setQueryData(queryKey, (items) => items?.map((current) => (current.id === item.id ? item : current))),
  })
  const remove = useMutation({
    mutationFn: (id) => api(`${path}/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.setQueryData(queryKey, (items) => items?.filter((item) => item.id !== id))
      dependents.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
    },
  })
  return { create, save, remove }
}

export const useUpdateDevice = () => useInlineUpdate(keys.devices, '/devices')
export const useUpdateFixedLoad = () => useInlineUpdate(keys.fixedLoads, '/fixed-loads')

// Al borrar un aparato el servidor borra también sus usos y sus rutinas
export const useDeviceCrud = () =>
  useListCrud(keys.devices, '/devices', 'device', [USAGES_KEY, keys.routines])
export const useFixedLoadCrud = () => useListCrud(keys.fixedLoads, '/fixed-loads', 'fixedLoad')
export const useRoutineCrud = () => useListCrud(keys.routines, '/routines', 'routine')

// Contrato y facturas

/** ¿Se puede guardar el contrato tal como está? Mientras se escribe puede faltar algún nombre. */
const contractIsComplete = (contract) =>
  [...contract.discounts, ...contract.dailyFees].every((item) => item.label.trim() !== '')

/**
 * Cambios del contrato escritos en línea: todas las cuentas se recalculan con cada tecla
 * y el guardado espera a que se deje de escribir.
 */
export function useUpdateContract() {
  const queryClient = useQueryClient()
  const timer = useRef(undefined)
  const [error, setError] = useState(null)

  /**
   * El cambio se aplica sobre el contrato más reciente, no sobre el que había al pintar la pantalla:
   * así dos cambios seguidos no se pisan aunque el segundo llegue antes de que se repinte.
   */
  function update(change) {
    const current = queryClient.getQueryData(keys.contract)
    if (!current) return
    const contract = change(current)
    queryClient.setQueryData(keys.contract, contract)
    clearTimeout(timer.current)
    if (!contractIsComplete(contract)) return
    timer.current = setTimeout(async () => {
      try {
        await api('/contract', { method: 'PUT', body: contract })
        setError(null)
      } catch (failure) {
        setError(failure)
        queryClient.invalidateQueries({ queryKey: keys.contract })
      }
    }, SAVE_DELAY_MS)
  }

  return { update, error, clearError: () => setError(null) }
}

export const useInvoices = () =>
  useQuery({ queryKey: keys.invoices, queryFn: async () => (await api('/invoices')).invoices })

export function useInvoiceCrud() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.invoices })
  const create = useMutation({
    mutationFn: async (input) =>
      (await api('/invoices', { method: 'POST', body: input })).invoice,
    onSuccess: refresh,
  })
  const save = useMutation({
    mutationFn: async ({ id, input }) =>
      (await api(`/invoices/${id}`, { method: 'PUT', body: input })).invoice,
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (id) => api(`/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  })
  return { create, save, remove }
}

/** Sube el PDF para que el servidor lo lea. La contraseña sólo se usa para abrirlo y no se guarda. */
export function useParseInvoice() {
  return useMutation({
    // `secret` es un `oneTimeSecret` con la contraseña del PDF (en DISA, el DNI del titular).
    // Se saca al montar el envío y el contenedor se queda vacío: las variables que guarda la
    // mutación para después ya no lo llevan.
    mutationFn: async ({ file, provider, secret }) => {
      const form = new FormData()
      form.append('provider', provider)
      const value = secret?.take()
      if (value) form.append(provider === 'disa' ? 'dni' : 'password', value)
      form.append('file', file)
      return (await api('/invoices/parse', { form })).parsed
    },
  })
}

/** Guarda la factura leída y, si se pide, sustituye el contrato por el que se deduce de ella */
export function useApplyParsedInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ parsed, updateContract }) => {
      if (updateContract) {
        const { contract } = await api('/contract', { method: 'PUT', body: parsed.contract })
        queryClient.setQueryData(keys.contract, contract)
      }
      const { contract: _contract, warnings: _warnings, ...invoice } = parsed
      return (await api('/invoices', { method: 'POST', body: invoice })).invoice
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.invoices }),
  })
}

// Cuentas (sólo administrador)

export const useAccounts = () =>
  useQuery({ queryKey: keys.users, queryFn: async () => (await api('/users')).users })

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (account) =>
      api('/users', { method: 'POST', body: account }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.users }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...changes }) =>
      api(`/users/${id}`, { method: 'PATCH', body: changes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.users }),
  })
}
