import { Link } from 'react-router'
import { Stat, StatRow } from '../../components/ui/Stat'
import { periodSummary } from '../../domain/aggregates'
import { approxEur, eur, kwh } from '../../domain/format'
import { estimateInvoice } from '../../domain/invoice'
import { datesBetween, weekdayOf } from '../../domain/time'
import { dayTitle, monthRange, monthYearTitle, todayISO } from '../../lib/dates'
import { consumoPath } from '../../lib/useSelectedDate'
import { monthHeat } from './colors'
import { TodayLink } from './TodayLink'

const WEEKDAYS = [
  ['L', 'Lun'],
  ['M', 'Mar'],
  ['X', 'Mié'],
  ['J', 'Jue'],
  ['V', 'Vie'],
  ['S', 'Sáb'],
  ['D', 'Dom'],
]
const BAR_MAX_PX = 96

/** Consumo · Mes: una casilla por día, con los consumos fijos ya sumados */
export function MonthView({ home, date }) {
  const { from, to } = monthRange(date)
  const month = periodSummary(home, datesBetween(from, to))
  const days = month.days
  const today = todayISO()

  const dayMax = Math.max(0.001, ...days.map((day) => day.total.kwh))
  const peak = days.reduce((top, day) => (day.total.cost > top.total.cost ? day : top), days[0])

  // Semanas del mes contadas de siete en siete desde el día 1, como en el diseño
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, i) => ({
    label: `S${i + 1}`,
    range: `${i * 7 + 1}–${Math.min(days.length, i * 7 + 7)}`,
    kwh: days.slice(i * 7, i * 7 + 7).reduce((total, day) => total + day.total.kwh, 0),
  }))
  const weekMax = Math.max(0.001, ...weeks.map((week) => week.kwh))

  const invoice = estimateInvoice(home.contract, days.length, month.byBand)
  const energy = invoice.energy.total - invoice.discounts.total
  const rest = invoice.total - energy - invoice.power.total
  const hasFuture = to > today && from <= today

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="page-title">{monthYearTitle(date)}</h2>
            <TodayLink span="mes" date={date} />
          </div>
          <p className="page-lead mt-2 max-w-[72ch] text-[12.5px]">
            Cada casilla es un día, con los consumos fijos ya sumados. Pulsa un día para abrirlo.
            {hasFuture && ' Los días que aún no han llegado cuentan sólo los fijos y las rutinas.'}
          </p>
        </div>
        <StatRow>
          <Stat label="Mes" value={kwh(month.total.kwh)} />
          <Stat label="Coste estimado" value={eur(month.total.cost)} />
          <Stat label="Media diaria · est." value={eur(month.total.cost / days.length)} />
          <Stat accent label="Día más caro" value={`Día ${Number(peak.date.slice(8))} · ${approxEur(peak.total.cost)}`} />
        </StatRow>
      </div>

      {/* Calendario de lunes a domingo: cada día cae bajo su día de la semana */}
      <div className="max-w-[1080px]">
        <div className="mb-1.5 grid grid-cols-7 gap-2 max-sm:gap-1" aria-hidden="true">
          {WEEKDAYS.map(([letter, name]) => (
            <div key={name} className="label px-2.5 max-sm:px-0 max-sm:text-center">
              <span className="sm:hidden">{letter}</span>
              <span className="max-sm:hidden">{name}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 max-sm:gap-1">
          {days.map((day, i) => {
            const selected = day.date === date
            const future = day.date > today
            const isToday = day.date === today
            return (
              <Link
                key={day.date}
                to={consumoPath('dia', day.date)}
                aria-label={`Abrir ${dayTitle(day.date)}: ${kwh(day.total.kwh, 1)}, unos ${eur(day.total.cost)} estimados`}
                aria-current={isToday ? 'date' : undefined}
                className={`flex min-h-[76px] flex-col justify-between rounded-control border px-2.5 py-2 hover:border-ink/40 max-sm:min-h-[58px] max-sm:items-center max-sm:rounded-[8px] max-sm:px-0 max-sm:py-1.5 ${selected ? 'border-accent outline-2 -outline-offset-1 outline-accent' : future ? 'border-dashed border-line-strong' : 'border-line'}`}
                style={{
                  gridColumnStart: i === 0 ? weekdayOf(day.date) + 1 : undefined,
                  // Los días que aún no han llegado son previsión: van sin color, con el borde a trazos
                  background: future ? undefined : monthHeat(Math.min(1, day.total.kwh / dayMax)),
                }}
              >
                <span className="flex items-center justify-between gap-1.5">
                  <span
                    className={`font-mono text-[13px] leading-none font-medium ${isToday ? '-mx-1 rounded-[5px] bg-accent px-1.5 py-1 text-white max-sm:mx-0' : future ? 'text-ink-3' : ''}`}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  {isToday && <span className="font-mono text-[10.5px] text-accent-ink max-sm:hidden">hoy</span>}
                </span>
                <span className={`flex items-baseline justify-between gap-2 ${future ? 'text-ink-3' : ''}`}>
                  <span className={`font-mono text-[11.5px] max-sm:hidden ${future ? '' : 'text-ink-2'}`}>
                    {kwh(day.total.kwh, 1)}
                  </span>
                  <span className="font-mono text-[12.5px] font-medium max-sm:text-[10.5px] max-sm:font-normal">
                    <span className="max-sm:hidden">≈ </span>
                    {eur(day.total.cost)}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <span className="font-mono text-[11px] text-ink-3">menos kWh</span>
          <div
            className="h-2 w-[120px] rounded-[4px] ring-1 ring-ink/8 ring-inset"
            style={{ background: `linear-gradient(to right, ${monthHeat(0)}, ${monthHeat(1)})` }}
          />
          <span className="font-mono text-[11px] text-ink-3">más kWh</span>
          {hasFuture && (
            <span className="ml-3 flex items-center gap-2 font-mono text-[11px] text-ink-3 max-sm:ml-0">
              <span className="size-3 rounded-[3px] border border-dashed border-ink/40" />
              previsión
            </span>
          )}
        </div>
      </div>

      <div className="mt-9 flex flex-wrap gap-x-12 gap-y-8">
        <div className="min-w-0 flex-1 basis-[360px]">
          <div className="label mb-4">kWh por semana del mes</div>
          <div className="flex h-[150px] max-w-[560px] items-end gap-4 border-b border-line-strong max-sm:gap-2.5">
            {weeks.map((week) => (
              <div key={week.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="font-mono text-[12.5px] font-medium text-ink">{week.kwh.toFixed(0)}</span>
                <div
                  className="w-full rounded-t-[6px] bg-heat-bar"
                  style={{ height: Math.round((week.kwh / weekMax) * BAR_MAX_PX) }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex max-w-[560px] gap-4 max-sm:gap-2.5">
            {weeks.map((week) => (
              <div key={week.label} className="flex-1 text-center font-mono text-[11.5px] leading-snug text-ink-2">
                {week.label}
                <span className="block text-[11px] text-ink-3">días {week.range}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-[320px] flex-none rounded-panel bg-surface-2 p-5 max-sm:w-full">
          <div className="label">Estimación de la factura</div>
          <div className="mt-3 font-mono text-[28px] leading-none tracking-[-0.015em]">{eur(invoice.total)}</div>
          <dl className="mt-4 text-[13px]">
            {[
              ['Energía', energy],
              ['Potencia', invoice.power.total],
              ['Cargos e impuestos', rest],
            ].map(([name, amount]) => (
              <div key={name} className="flex items-baseline justify-between gap-3 border-t border-line py-2">
                <dt className="text-ink-2">{name}</dt>
                <dd className="font-mono text-[12.5px]">{eur(amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 border-t border-line pt-3 text-[12px] leading-normal text-ink-3">Cámbialo en «Tarifa y factura».</p>
        </div>
      </div>
    </div>
  )
}
