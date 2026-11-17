import { addMonths, format, getISOWeek, lastDayOfMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** Hoy, en la hora local de quien usa la app */
export const todayISO = () => format(new Date(), 'yyyy-MM-dd')

export const isDateISO = (value) =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime())

/** «Lunes 14» */
export const dayTitle = (date) => capitalize(format(parseISO(date), 'EEEE d', { locale: es }))

/** «Septiembre» */
export const monthTitle = (date) => capitalize(format(parseISO(date), 'LLLL', { locale: es }))

/** «3 oct 2026» */
export const shortDate = (date) => format(parseISO(date), 'd MMM yyyy', { locale: es })

export const weekNumber = (date) => getISOWeek(parseISO(date))

/** Primer y último día del mes de la fecha */
export function monthRange(date) {
  return { from: date.slice(0, 8) + '01', to: format(lastDayOfMonth(parseISO(date)), 'yyyy-MM-dd') }
}

/** «Octubre 2026» */
export const monthYearTitle = (date) => capitalize(format(parseISO(date), 'LLLL yyyy', { locale: es }))

/** «28 sep – 4 oct» */
export const rangeLabel = (from, to) =>
  `${format(parseISO(from), 'd MMM', { locale: es })} – ${format(parseISO(to), 'd MMM', { locale: es })}`

/** La misma fecha unos meses antes o después; si el día no existe, el último del mes */
export const shiftMonth = (date, months) => format(addMonths(parseISO(date), months), 'yyyy-MM-dd')
