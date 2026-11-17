import { Link } from 'react-router'
import { addDays, startOfWeek } from '../../domain/time'
import { monthRange, todayISO } from '../../lib/dates'
import { consumoPath } from '../../lib/useSelectedDate'

/** Atajo para volver a hoy; no aparece si el día, la semana o el mes en pantalla ya es el actual */
export function TodayLink({ span, date }) {
  const today = todayISO()
  const monday = startOfWeek(date)
  const isCurrent =
    span === 'dia'
      ? date === today
      : span === 'semana'
        ? today >= monday && today <= addDays(monday, 6)
        : monthRange(date).from === monthRange(today).from
  if (isCurrent) return null

  return (
    <Link
      to={consumoPath(span, today)}
      className="grid min-h-[28px] place-items-center rounded-chip border border-accent-line bg-accent-soft px-2.5 text-[12px] leading-none text-accent-ink hover:border-accent hover:bg-accent/15 max-sm:min-h-9 max-sm:px-3 max-sm:text-[13px]"
    >
      {span === 'dia' ? 'Ir a hoy' : span === 'semana' ? 'Ir a esta semana' : 'Ir a este mes'}
    </Link>
  )
}
