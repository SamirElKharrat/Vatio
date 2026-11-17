import { weekdayOf } from './time'
import { hasOverlap } from './usages'

/**
 * Estado de una rutina en una fecha. Es la única fuente de verdad: de aquí salen si se apunta,
 * la etiqueta de la tarjeta y qué botones se pueden usar.
 *
 * - `paused`: la pausa ya ha empezado (`pausedFrom` es esa fecha o anterior). Manda sobre todo lo demás.
 * - `skipped`: ese día se ha saltado. Va antes que `off` para que el salto siempre se pueda deshacer.
 * - `off`: ese día de la semana no toca.
 * - `active`: se apunta.
 *
 * Una pausa con fecha futura no cambia el estado de hoy: la rutina sigue en marcha hasta ese día.
 */
export function routineStatus(routine, date) {
  if (routine.pausedFrom !== null && date >= routine.pausedFrom) return 'paused'
  if (routine.skippedDates.includes(date)) return 'skipped'
  if (!routine.weekdays.includes(weekdayOf(date))) return 'off'
  return 'active'
}

/** ¿Toca la rutina en esa fecha? Tiene en cuenta los días de la semana, los saltos y la pausa. */
export const routineRunsOn = (routine, date) => routineStatus(routine, date) === 'active'

/**
 * Usos de un día: los apuntados a mano más los que generan las rutinas.
 * Una rutina no se añade si choca con un uso del mismo aparato que ya esté en el día.
 */
export function usagesFor(date, manual, routines) {
  const usages = manual.filter((usage) => usage.date === date)
  for (const routine of routines) {
    if (!routineRunsOn(routine, date)) continue
    const start = Math.max(0, Math.min(23.75, routine.start))
    const hours = Math.max(0.25, Math.min(24 - start, routine.hours))
    if (hasOverlap(usages, routine.deviceId, start, hours)) continue
    usages.push({
      id: routine.id + ':' + date,
      deviceId: routine.deviceId,
      date,
      start,
      hours,
      routineId: routine.id,
    })
  }
  return usages
}

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Texto del tipo «todos los días a las 14:00» o «L · X · V a las 22:00» */
export function routineWhen(weekdays, startLabel) {
  if (weekdays.length === 7) return 'todos los días a las ' + startLabel
  const days = [...weekdays].sort((a, b) => a - b).map((day) => DAY_LETTERS[day])
  return days.join(' · ') + ' a las ' + startLabel
}
