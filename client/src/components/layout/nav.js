/** `short` es el nombre que cabe en la barra de pestañas del móvil; `icon`, el dibujo de `marks.jsx` */
export const NAV = [
  { to: '/consumo', label: 'Consumo', short: 'Consumo', icon: 'consumo' },
  { to: '/aparatos', label: 'Aparatos', short: 'Aparatos', icon: 'aparatos' },
  { to: '/fijos', label: 'Fijos y rutinas', short: 'Rutinas', icon: 'fijos' },
  { to: '/tarifa', label: 'Tarifa y factura', short: 'Tarifa', icon: 'tarifa' },
]

/** La propia cuenta: se abre desde el nombre, junto a «Salir», no desde las pestañas */
export const PROFILE_NAV = { to: '/cuenta', label: 'Mi cuenta', short: 'Mi cuenta', icon: 'cuentas' }

/** Sólo la ve el administrador */
export const ADMIN_NAV = { to: '/cuentas', label: 'Cuentas', short: 'Cuentas', icon: 'cuentas' }
