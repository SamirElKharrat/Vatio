import { useId, useRef, useState } from 'react'
import { fromWatts, POWER_UNITS, storedWatts, toWatts } from '../../domain/power'

const INPUT =
  'w-full min-w-0 rounded-chip border border-control-line bg-control px-3 py-2.5 font-mono text-[14px] text-ink hover:border-ink/35 max-sm:text-base'
const CHIP = 'rounded-[6px] px-2.5 py-1.5 text-[12.5px] leading-none'

/** Cifra en la unidad pedida, con coma y como mucho 3 decimales: 1200 W → «1,2» kW */
function shown(watts, unit) {
  if (!watts || unit === 'VA') return ''
  const value = fromWatts(watts, { unit })
  return String(Math.round(value * 1000) / 1000).replace('.', ',')
}

/** Lo que se explica debajo según la unidad elegida */
const HINTS = {
  W: 'Lo pone la etiqueta del aparato, junto a «W».',
  kW: 'Si la etiqueta lo dice en kW: 1,2 kW son 1200 W.',
  kWhYear: 'Lo pone la etiqueta energética (la de las letras A–G). Úsalo en lo que está siempre enchufado: nevera, congelador…',
  VA: 'Mira la etiqueta del cargador o del enchufe, en «OUTPUT»: por ejemplo 12V ⎓ 1.5A. Es el máximo; el consumo real suele ser algo menor.',
}

/**
 * Campo de potencia con selector de unidad: W, kW, kWh al año o voltios × amperios.
 * Se guarda siempre en vatios; `onChange` recibe los W enteros, o `null` mientras no haya una cifra válida.
 */
export function PowerInput({ initialWatts, onChange, label = 'Potencia' }) {
  const id = useId()
  const [unit, setUnit] = useState('W')
  const [value, setValue] = useState(initialWatts ? String(initialWatts) : '')
  const [volts, setVolts] = useState('')
  const [amps, setAmps] = useState('')
  const watts = storedWatts(toWatts({ unit, value, volts, amps }))
  // La última cifra válida, para no perderla al pasar por V × A y volver
  const lastWatts = useRef(initialWatts ?? null)

  function update(changes) {
    const next = { unit, value, volts, amps, ...changes }
    if ('unit' in changes) setUnit(changes.unit)
    if ('value' in changes) setValue(changes.value)
    if ('volts' in changes) setVolts(changes.volts)
    if ('amps' in changes) setAmps(changes.amps)
    const result = storedWatts(toWatts(next))
    if (result) lastWatts.current = result
    onChange(result)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-start max-sm:gap-1.5">
        <span className="w-[110px] flex-none text-[13px] text-ink-2">{label} en</span>
        <div className="flex flex-wrap gap-[3px] rounded-chip bg-ink/8 p-[3px]" role="radiogroup" aria-label="Unidad de la potencia">
          {POWER_UNITS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={unit === option.id}
              // Al cambiar de unidad la cifra se convierte (1200 W → 1,2 kW); en V × A se escriben los dos datos
              onClick={() => unit !== option.id && update({ unit: option.id, value: shown(watts ?? lastWatts.current, option.id) })}
              className={`${CHIP} ${unit === option.id ? 'bg-control text-ink shadow-raised' : 'text-ink-2 hover:text-ink'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-1.5">
        <label htmlFor={id} className="w-[110px] flex-none text-[13px] text-ink-2 max-sm:sr-only">
          {unit === 'VA' ? 'Voltios × amperios' : 'Cifra'}
        </label>
        {unit === 'VA' ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input id={id} className={INPUT} inputMode="decimal" placeholder="12" aria-label="Voltios" value={volts} onChange={(event) => update({ volts: event.target.value })} />
            <span className="text-[13px] text-ink-3">V ×</span>
            <input className={INPUT} inputMode="decimal" placeholder="1,5" aria-label="Amperios" value={amps} onChange={(event) => update({ amps: event.target.value })} />
            <span className="text-[13px] text-ink-3">A</span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              id={id}
              className={INPUT}
              inputMode="decimal"
              placeholder={unit === 'kW' ? '1,2' : unit === 'kWhYear' ? '300' : '1200'}
              value={value}
              onChange={(event) => update({ value: event.target.value })}
            />
            <span className="flex-none text-[13px] text-ink-3">{unit === 'kWhYear' ? 'kWh/año' : unit}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:pl-[122px]">
        {unit !== 'W' && (
          <span className={`rounded-[6px] px-2 py-1 font-mono text-[12px] ${watts ? 'bg-ok-soft text-ok-ink' : 'bg-ink/6 text-ink-3'}`}>
            {watts ? `= ${watts} W${unit === 'kWhYear' ? ' de media' : ''}` : '= … W'}
          </span>
        )}
        <p className="text-[12px] leading-normal text-ink-3">{HINTS[unit]}</p>
      </div>
    </div>
  )
}
