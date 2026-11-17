export const QUARTER = 0.25

export const snapQuarter = (hours) => Math.round(hours * 4) / 4

/** Lee «19:30», «19.5» o «19,5» y devuelve horas decimales redondeadas a cuartos; `null` si no se entiende. */
export function parseHM(value) {
  const text = String(value ?? '').trim().replace(',', '.')
  let hours
  let minutes = 0
  const clock = /^(\d{1,2}):(\d{0,2})$/.exec(text)
  if (clock) {
    hours = parseInt(clock[1], 10)
    minutes = parseInt(clock[2] || '0', 10)
  } else if (/^\d{1,2}(\.\d+)?$/.test(text)) {
    const n = parseFloat(text)
    hours = Math.floor(n)
    minutes = Math.round((n - hours) * 60)
  } else {
    return null
  }
  if (minutes >= 60) return null
  const t = hours + minutes / 60
  if (t < 0 || t > 24) return null
  return snapQuarter(t)
}

/** 19,5 → «19:30» */
export function formatHM(t) {
  const hours = Math.floor(t)
  const minutes = Math.round((t - hours) * 60)
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')
}

/** Convierte dos horas escritas en inicio y duración, o dice qué falla. */
export function parseRange(from, to) {
  const start = parseHM(from)
  const end = parseHM(to)
  if (start === null || end === null) return { error: 'formato' }
  if (end <= start) return { error: 'orden' }
  return { start, hours: end - start }
}

// Las fechas se manejan como texto YYYY-MM-DD y en UTC, para que el cambio de hora no mueva ningún día.
const toDate = (date) => new Date(date + 'T00:00:00Z')
const toISO = (date) => date.toISOString().slice(0, 10)

/** 0 = lunes … 6 = domingo */
export const weekdayOf = (date) => (toDate(date).getUTCDay() + 6) % 7

export function addDays(date, days) {
  const d = toDate(date)
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

/** Todas las fechas entre dos, ambas incluidas */
export function datesBetween(from, to) {
  const dates = []
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date)
  return dates
}

/** Lunes de la semana a la que pertenece la fecha */
export const startOfWeek = (date) => addDays(date, -weekdayOf(date))
