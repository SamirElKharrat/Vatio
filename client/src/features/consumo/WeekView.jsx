import { Link } from 'react-router'
import { Stat, StatRow } from '../../components/ui/Stat'
import { periodSummary } from '../../domain/aggregates'
import { eur, kwh } from '../../domain/format'
import { bandAt } from '../../domain/tariff'
import { addDays, datesBetween, startOfWeek } from '../../domain/time'
import { dayTitle, rangeLabel, todayISO, weekNumber } from '../../lib/dates'
import { consumoPath } from '../../lib/useSelectedDate'
import { BAND_SOFT, weekHeat } from './colors'
import { TodayLink } from './TodayLink'

// En el móvil, el día y sus cifras van en un renglón y las 24 celdas debajo, a todo el ancho
const GRID =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[132px_minmax(0,1fr)_250px]'
const RULER = Array.from({ length: 8 }, (_, i) => String(i * 3).padStart(2, '0'))

/** Consumo · Semana: una fila por día y una celda por hora; cuanto más oscura, más kWh */
export function WeekView({ home, date }) {
  const monday = startOfWeek(date)
  const sunday = addDays(monday, 6)
  const week = periodSummary(home, datesBetween(monday, sunday))
  const isFija = home.contract.mode === 'fija'

  const cellMax = Math.max(0.001, ...week.days.flatMap((day) => day.hourlyKwh))
  const dayMax = Math.max(0.001, ...week.days.map((day) => day.kwh))
  const today = todayISO()

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="page-title">Semana {weekNumber(date)}</h2>
            <span className="font-mono text-[12px] text-ink-3">{rangeLabel(monday, sunday)}</span>
            <TodayLink span="semana" date={date} />
          </div>
          <p className="page-lead mt-2 text-[12.5px]">
            Cada celda es una hora: cuanto más oscura, más kWh. Pulsa un día para abrirlo.
          </p>
        </div>
        <StatRow>
          <Stat label="Semana" value={kwh(week.kwh)} />
          <Stat label="Coste" value={eur(week.cost)} />
        </StatRow>
      </div>

      <div className="overflow-x-auto">
        <div className="sm:min-w-[760px]">
          <div className={`${GRID} mb-1 px-2.5 max-sm:px-0`}>
            <div className="max-sm:hidden" />
            <div className="flex max-sm:col-span-2">
              {RULER.map((hour) => (
                <div key={hour} className="flex-1 border-l border-line-strong pb-1 pl-1.5 font-mono text-[11px] leading-none text-ink-3">
                  {hour}
                </div>
              ))}
            </div>
            <div className="max-sm:hidden" />
          </div>

          {week.days.map((day) => {
            const selected = day.date === date
            return (
              <Link
                key={day.date}
                to={consumoPath('dia', day.date)}
                aria-label={`Abrir ${dayTitle(day.date)}`}
                className={`${GRID} rounded-chip px-2.5 py-2 max-sm:rounded-none max-sm:border-t max-sm:border-line max-sm:px-0 max-sm:py-3 ${selected ? 'bg-accent/7 max-sm:bg-transparent' : 'hover:bg-hover'}`}
              >
                <div className={`text-[13.5px] max-sm:text-[14.5px] ${selected ? 'font-medium' : ''}`}>
                  {dayTitle(day.date)}
                  {day.date === today && (
                    <span className="ml-2 rounded-[4px] bg-accent/12 px-1.5 py-[3px] font-mono text-[11.5px] leading-none font-normal text-accent-ink">
                      hoy
                    </span>
                  )}
                </div>
                <div className="flex gap-0.5 max-sm:order-last max-sm:col-span-2 max-sm:gap-px">
                  {day.hourlyKwh.map((value, hour) => (
                    <div
                      key={hour}
                      title={`${dayTitle(day.date)} · ${String(hour).padStart(2, '0')}:00 · ${kwh(value)}`}
                      className={`h-[30px] flex-1 rounded-swatch max-sm:h-[26px] max-sm:rounded-[2px] ${value > 0 ? '' : isFija ? 'bg-ink/6' : BAND_SOFT[bandAt(day.date, hour)]}`}
                      style={value > 0 ? { background: weekHeat(Math.min(1, value / cellMax)) } : undefined}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-swatch bg-ink/8 max-sm:hidden">
                    <div className="h-full rounded-swatch bg-heat-mid" style={{ width: `${(day.kwh / dayMax) * 100}%` }} />
                  </div>
                  <span className={`w-[84px] text-right font-mono text-[12px] ${day.kwh ? 'text-ink-2' : 'text-ink-4'}`}>
                    {day.kwh ? kwh(day.kwh) : '—'}
                  </span>
                  <span className={`w-[60px] text-right font-mono text-[12.5px] ${day.cost ? 'font-medium' : 'text-ink-4'}`}>
                    {day.cost ? eur(day.cost) : '—'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-line pt-4">
        <span className="font-mono text-[11px] text-ink-3">menos kWh</span>
        <div className="h-2 w-[160px] rounded-[4px] bg-linear-to-r from-heat-low to-heat-high" />
        <span className="font-mono text-[11px] text-ink-3">más kWh</span>
        <span className="text-[12px] text-ink-3 sm:ml-[18px]">
          {isFija
            ? 'Las celdas sin uso quedan en gris. Los consumos fijos no se pintan.'
            : 'Las celdas sin uso muestran el color del tramo horario. Los consumos fijos no se pintan.'}
        </span>
      </div>
    </div>
  )
}
