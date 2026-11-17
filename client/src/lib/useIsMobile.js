import { useSyncExternalStore } from 'react'

// El mismo corte que `sm` en Tailwind: por debajo, la app usa las pantallas de móvil del diseño
const QUERY = '(max-width: 639px)'

function subscribe(onChange) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/** ¿La ventana tiene ancho de móvil? Para las pantallas que cambian de estructura y no sólo de tamaño */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
