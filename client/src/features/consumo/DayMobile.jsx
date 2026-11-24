import { Link } from 'react-router'
import { Chevron } from '../../components/layout/marks'
import { useHousehold } from '../../api/hooks'
import { periodSummary } from '../../domain/aggregates'
import { usageCost, usageKwh, usageWatts } from '../../domain/cost'
import { approxEur, eur, kwh } from '../../domain/format'
import { powerProfile } from '../../domain/power'
import { bandAt, dayBands } from '../../domain/tariff'
import { addDays, datesBetween, formatHM, startOfWeek } from '../../domain/time'
import { dayTitle, monthRange, monthTitle, todayISO } from '../../lib/dates'
import { splitUnit } from '../../lib/splitUnit'
import { consumoPath } from '../../lib/useSelectedDate'
import { BAND_BG, BAND_NAME, deviceColor, deviceColorSoft } from './colors'
import { PowerNotice } from './PowerWarning'
import { TodayLink } from './TodayLink'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const WEEK_BAR_PX = 40

/** Consumo · Día en el móvil: el resumen del día, la semana en barras y la lista de usos */
export function DayMobile({ home, date, day, notice, onOpen, onAdd }) {
  const { contract } = home
  const isFija = contract.mode === 'fija'
  const bands = dayBands(date)
  const devices = new Map(home.devices.map((device) => [device.id, device]))
  const power = powerProfile(home, date)

  const monday = startOfWeek(date)
  const week = periodSummary(home, datesBetween(monday, addDays(monday, 6))).days
  const weekMax = Math.max(0.001, ...week.map((weekDay) => weekDay.kwh))

  const range = monthRange(date)
  const monthData = useHousehold(range.from, range.to)
  const month = monthData.home ? periodSummary(monthData.home, datesBetween(range.from, range.to)).total : null

  const today = todayISO()
  const [dayFigure, dayUnit] = splitUnit(kwh(day.kwh))
  const diary = day.usages
    .filter((usage) => devices.has(usage.deviceId))
    .sort((a, b) => a.start - b.start || a.deviceId.localeCompare(b.deviceId))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div>
          <h2 className="page-title">{dayTitle(date)}</h2>
          <p className="mt-1.5 font-mono text-[12px] text-ink-3">
            {diary.length === 1 ? '1 uso apuntado' : `${diary.length} usos apuntados`}
          </p>
        </div>
        <TodayLink span="dia" date={date} />
      </div>

      {notice && <div className="mt-4">{notice}</div>}

      <div className="mt-4 rounded-modal bg-ink p-5 shadow-lifted">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="label text-white/60">Consumo</div>
            <div className="mt-2 font-mono text-[38px] leading-none tracking-[-0.02em] text-white">
              {dayFigure}
              {dayUnit && <span className="ml-1.5 text-[17px] tracking-normal text-white/65">{dayUnit}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="label text-white/60">Coste estimado</div>
            <div className="mt-2 font-mono text-[22px] leading-none text-[oklch(0.84_0.12_58)]">{eur(day.cost)}</div>
          </div>
        </div>
        {/* Con precio fijo no hay tramos que pintar: la banda sólo sale con la tarifa por tramos */}
        {!isFija && (
          <div className="mt-5 flex h-2 overflow-hidden rounded-[4px]">
            {HOURS.map((hour) => (
              <div key={hour} className={`flex-1 ${BAND_BG[bands[hour]]}`} />
            ))}
          </div>
        )}
        <div
          className={`relative h-[34px] rounded-[6px] bg-white/6 bg-[repeating-linear-gradient(to_right,rgb(255_255_255/0.14)_0_1px,transparent_1px_25%)] ${isFija ? 'mt-5' : 'mt-1.5'}`}
        >
          {power.over.map((range) => (
            <div
              key={`over-${range.start}`}
              aria-hidden="true"
              className="absolute inset-y-0 rounded-[3px] border-x border-dashed border-[oklch(0.72_0.17_28)] bg-[oklch(0.62_0.2_28/0.35)]"
              style={{ left: `${(range.start / 24) * 100}%`, width: `${((range.end - range.start) / 24) * 100}%` }}
            />
          ))}
          {diary.map((usage) => {
            const device = devices.get(usage.deviceId)
            return (
              <div
                key={usage.id}
                className="absolute inset-y-1.5 rounded-[5px]"
                style={{
                  left: `${(usage.start / 24) * 100}%`,
                  width: `${(usage.hours / 24) * 100}%`,
                  background: usage.routineId ? deviceColorSoft(device.color) : deviceColor(device.color),
                }}
              />
            )
          })}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-white/60">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        {/* Los fijos no entran en la barra: se despliegan aquí para saber cuáles son */}
        <details className="group mt-3.5 border-t border-white/12 pt-3.5 font-mono text-[12px] text-white/70">
          <summary className="flex cursor-pointer list-none justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span>
              más los fijos (24 h) <span className="inline-block transition-transform group-open:rotate-90">›</span>
            </span>
            <span>{approxEur(day.fixed.cost)}</span>
          </summary>
          {home.fixedLoads.length === 0 ? (
            <p className="mt-2.5 text-white/55">Ninguno. Añádelos en Fijos y rutinas.</p>
          ) : (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {home.fixedLoads.map((load) => (
                <li key={load.id} className="flex justify-between gap-3">
                  <span className="truncate">{load.name}</span>
                  <span className="text-white/55">{load.watts} W</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>
      {(!power.hasLimit || power.over.length > 0) && (
        <div className="mt-3.5">
          <PowerNotice profile={power} date={date} devices={home.devices} />
        </div>
      )}

      <nav aria-label="Días de la semana" className="mt-5 flex items-end gap-[7px]">
        {week.map((weekDay, i) => {
          const selected = weekDay.date === date
          return (
            <Link
              key={weekDay.date}
              to={consumoPath('dia', weekDay.date)}
              aria-label={`${dayTitle(weekDay.date)}: ${kwh(weekDay.kwh)}`}
              aria-current={selected ? 'date' : undefined}
              className="flex flex-1 flex-col items-center gap-1.5 pb-1"
            >
              <div className="flex w-full items-end" style={{ height: WEEK_BAR_PX }}>
                <div
                  className={`w-full rounded-t-[5px] ${selected ? 'bg-accent' : 'bg-ink/16'}`}
                  style={{ height: Math.max(3, Math.round((weekDay.kwh / weekMax) * WEEK_BAR_PX)) }}
                />
              </div>
              <span
                className={`grid h-[22px] w-full place-items-center rounded-[6px] font-mono text-[11.5px] font-medium ${selected ? 'bg-accent-soft text-accent-ink' : 'text-ink-3'}`}
              >
                {DAY_LETTERS[i]}
                {weekDay.date === today && <span className="sr-only"> (hoy)</span>}
              </span>
            </Link>
          )
        })}
      </nav>

      <Link
        to={consumoPath('mes', date)}
        className="mt-2.5 flex items-center gap-3 rounded-[13px] border border-line-strong bg-control py-3.5 pr-3 pl-4 shadow-raised active:bg-surface"
      >
        <span className="label">{monthTitle(date)}</span>
        <span className="flex-1 font-mono text-[13.5px]">{month ? kwh(month.kwh) : '— kWh'}</span>
        <span className="font-mono text-[13.5px] font-medium text-accent-ink">{month ? approxEur(month.cost) : '— €'}</span>
        <Chevron className="size-3.5 text-ink-4" />
      </Link>

      {!isFija && day.valleSaving > 0.005 && (
        <div className="mt-3.5 flex items-center gap-2.5 rounded-[13px] border border-gap-line bg-gap px-[15px] py-[13px]">
          <span className="font-mono text-[15px] font-medium text-gap-ink">↓</span>
          <span className="flex-1 text-[12.5px] leading-snug">
            Con todo el consumo en valle te ahorrarías <b>{approxEur(day.valleSaving)}</b> este día
          </span>
        </div>
      )}

      <div className="label mt-7 mb-1.5">Usos apuntados</div>
      {diary.length === 0 && (
        <p className="py-6 text-[13.5px] leading-relaxed text-ink-3">
          Nada apuntado este día. Pulsa <b>+ Apuntar un uso</b> para añadir el primero.
        </p>
      )}
      {diary.map((usage) => {
        const device = devices.get(usage.deviceId)
        const band = bandAt(date, Math.floor(usage.start))
        return (
          <button
            key={usage.id}
            type="button"
            onClick={() => onOpen(usage.id)}
            className="flex w-full items-center gap-[13px] border-b border-line py-[13px] text-left active:bg-hover"
          >
            <span
              className="grid size-11 flex-none place-items-center rounded-panel font-mono text-[12px] font-medium text-white"
              style={{ background: deviceColor(device.color) }}
            >
              {formatHM(usage.start).slice(0, 2)}h
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{device.name}</span>
              <span className="mt-1 block truncate font-mono text-[12px] text-ink-3">
                {usage.routineId && '⟳ '}
                {formatHM(usage.start)}–{formatHM(usage.start + usage.hours)} · {kwh(usageKwh(usageWatts(device, usage), usage.hours))}
              </span>
              {usage.note && <span className="mt-0.5 block truncate text-[12px] text-ink-3">{usage.note}</span>}
            </span>
            <span className="flex flex-none flex-col items-end gap-[5px]">
              <span className="font-mono text-[14.5px] font-medium">
                {approxEur(usageCost(contract, usageWatts(device, usage), date, usage.start, usage.hours))}
              </span>
              {!isFija && (
                <span
                  className={`rounded-[4px] px-1.5 py-[3px] font-mono text-[11px] leading-none font-medium tracking-[0.06em] text-ink-2 uppercase ${BAND_BG[band]}`}
                >
                  {BAND_NAME[band]}
                </span>
              )}
            </span>
          </button>
        )
      })}

      {/* Se queda a la vista sobre las pestañas mientras se recorre la lista */}
      <div className="sticky bottom-[calc(var(--tabbar)+env(safe-area-inset-bottom)+10px)] mt-5">
        <button
          type="button"
          onClick={onAdd}
          className="h-[54px] w-full rounded-[15px] bg-accent text-[15.5px] font-medium text-white shadow-[0_8px_20px_-4px_rgb(38_33_27/0.35)] active:translate-y-px active:bg-accent-hover disabled:opacity-50"
        >
          + Apuntar un uso
        </button>
      </div>
    </div>
  )
}
