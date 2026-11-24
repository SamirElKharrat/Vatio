import { Link } from 'react-router'
import { SLOTS } from '../../domain/power'
import { bandAt } from '../../domain/tariff'
import { formatHM } from '../../domain/time'

const kw = (watts) => (watts / 1000).toFixed(watts % 1000 === 0 ? 0 : 2).replace(/0$/, '').replace('.', ',') + ' kW'

/** «horno, vitrocerámica y lavadora» */
function listNames(names) {
  if (names.length <= 1) return names.join('')
  return names.slice(0, -1).join(', ') + ' y ' + names.at(-1)
}

/** Texto de una franja que se pasa de la potencia contratada */
function rangeText(range, date, devices) {
  const term = bandAt(date, Math.floor(range.start)) === 'valle' ? 'valle' : 'punta-llano'
  const names = range.deviceIds.map((id) => devices.get(id)?.name.toLowerCase()).filter(Boolean)
  return {
    head: `De ${formatHM(range.start)} a ${formatHM(range.end)} se juntan ${kw(range.peakWatts)}`,
    rest: ` y tienes ${kw(range.limitWatts)} contratados en ${term}.${names.length > 1 ? ` Coinciden ${listNames(names)}.` : ''}`,
  }
}

/**
 * Aviso encima de la rejilla cuando lo encendido a la vez pasa de la potencia contratada.
 * Dice «puede» porque los W son los de la etiqueta: el máximo, que no siempre se da a la vez.
 */
export function PowerNotice({ profile, date, devices }) {
  if (!profile.hasLimit) {
    return (
      <p className="text-[12px] leading-normal text-ink-3">
        Pon tu potencia contratada en{' '}
        <Link to="/tarifa" className="text-ink-2 underline underline-offset-2 hover:text-ink">
          Tarifa y factura
        </Link>{' '}
        para avisarte si lo que enciendes a la vez se pasa.
      </p>
    )
  }
  if (profile.over.length === 0) return null
  const byId = new Map(devices.map((device) => [device.id, device]))
  const shown = profile.over.slice(0, 2)
  const more = profile.over.length - shown.length
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-control border border-danger-ink/20 bg-danger-soft px-3.5 py-3 text-[13px] leading-snug text-danger-ink">
      <span aria-hidden="true" className="text-[15px] leading-none">⚠</span>
      <div className="flex flex-col gap-1">
        {shown.map((range) => {
          const text = rangeText(range, date, byId)
          return (
            <p key={range.start}>
              <b className="font-semibold">{text.head}</b>
              {text.rest}
            </p>
          )
        })}
        {more > 0 && <p>Y {more === 1 ? 'otra franja más' : `${more} franjas más`} en rojo en la rejilla.</p>}
        <p className="text-[12px] opacity-80">Puede saltar el limitador: separa alguno de ellos.</p>
      </div>
    </div>
  )
}

/** Franjas rojas que cruzan la pista de un aparato en las horas que se pasan */
export function PowerOverlay({ over }) {
  return over.map((range) => (
    <div
      key={range.start}
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-[1] border-x border-dashed border-danger-ink/60 bg-danger-ink/12"
      style={{ left: `${(range.start / 24) * 100}%`, width: `${((range.end - range.start) / 24) * 100}%` }}
    />
  ))
}

/**
 * Lo encendido en cada cuarto de hora, en barras, con la potencia contratada como línea discontinua.
 * Las barras que la pasan van en rojo.
 */
export function PowerBars({ profile, className = '' }) {
  const peak = Math.max(1, ...profile.slots.map((slot) => Math.max(slot.watts, slot.limit)))
  const scale = peak * 1.12
  // Tramos seguidos con el mismo límite, para pintar la línea por trozos
  const limitRuns = []
  profile.slots.forEach((slot, q) => {
    const last = limitRuns.at(-1)
    if (last && last.limit === slot.limit) last.to = q + 1
    else limitRuns.push({ limit: slot.limit, from: q, to: q + 1 })
  })
  return (
    <div className={`relative flex items-end gap-px ${className}`}>
      {profile.slots.map((slot, q) => (
        <div
          key={q}
          title={`${formatHM(q / 4)} · ${kw(slot.watts)}${slot.limit ? ` de ${kw(slot.limit)}` : ''}`}
          className={`flex-1 rounded-t-[1.5px] ${slot.limit > 0 && slot.watts > slot.limit ? 'bg-danger-ink' : 'bg-ink/18'}`}
          style={{ height: `${Math.max(2, (slot.watts / scale) * 100)}%` }}
        />
      ))}
      {limitRuns
        .filter((run) => run.limit > 0)
        .map((run) => (
          <div
            key={run.from}
            aria-hidden="true"
            className="pointer-events-none absolute border-t-[1.5px] border-dashed border-ink-2"
            style={{
              left: `${(run.from / SLOTS) * 100}%`,
              width: `${((run.to - run.from) / SLOTS) * 100}%`,
              bottom: `${(run.limit / scale) * 100}%`,
            }}
          />
        ))}
    </div>
  )
}

