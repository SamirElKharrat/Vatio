import { useState } from 'react'
import { convertPower, MAINS_VOLTS, POWER_UNITS } from '../../domain/power'

const INPUT =
  'min-w-0 rounded-chip border border-control-line bg-control px-2.5 py-2 font-mono text-[13.5px] text-ink hover:border-ink/35 max-sm:text-base'
const CHIP = 'rounded-[6px] px-2.5 py-1.5 text-[12.5px] leading-none'
const STORE_KEY = 'vatios:calculadora-abierta'

/** Unidad en la que sale el resultado: V × A, al ir a ella, devuelve amperios */
const RESULT_UNIT = { W: 'W', kW: 'kW', kWhYear: 'kWh/año', VA: 'A' }

function readOpen() {
  try {
    return localStorage.getItem(STORE_KEY) === '1'
  } catch {
    return false
  }
}

function UnitPicker({ label, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-[3px] rounded-chip bg-ink/8 p-[3px]" role="radiogroup" aria-label={label}>
      {POWER_UNITS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={`${CHIP} ${value === option.id ? 'bg-control text-ink shadow-raised' : 'text-ink-2 hover:text-ink'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Cifra con coma y hasta 2 decimales (3 si es pequeña): 1,2 · 8,7 · 0,045 */
function format(value) {
  const digits = Math.abs(value) < 1 ? 3 : 2
  return String(Math.round(value * 10 ** digits) / 10 ** digits).replace('.', ',')
}

/**
 * Calculadora de potencia: de una unidad a otra en los dos sentidos, siempre pasando por vatios.
 * Al ir a V × A hay que decir los voltios (230 en un enchufe de casa) y devuelve los amperios.
 */
export function PowerCalculator() {
  const [open, setOpen] = useState(readOpen)
  const [from, setFrom] = useState('kW')
  const [to, setTo] = useState('W')
  const [value, setValue] = useState('1,2')
  const [volts, setVolts] = useState('12')
  const [amps, setAmps] = useState('1,5')
  const [toVolts, setToVolts] = useState(String(MAINS_VOLTS))
  const [copied, setCopied] = useState(false)

  const result = convertPower({ unit: from, value, volts, amps }, { unit: to, volts: toVolts })
  const resultText = result === null ? '…' : `${format(result)} ${RESULT_UNIT[to]}`

  function toggle() {
    setOpen(!open)
    try {
      localStorage.setItem(STORE_KEY, open ? '0' : '1')
    } catch {
      // Sin almacenamiento simplemente no se recuerda
    }
  }

  // ⇄: el resultado pasa a ser la cifra de partida
  function swap() {
    if (result !== null && to !== 'VA') setValue(format(result))
    if (to === 'VA' && result !== null) {
      setVolts(toVolts)
      setAmps(format(result))
    }
    setFrom(to)
    setTo(from)
    setCopied(false)
  }

  async function copy() {
    if (result === null) return
    try {
      await navigator.clipboard.writeText(format(result))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-panel border border-line-strong bg-control">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="label">Calculadora</span>
          <span className="ml-2 text-[12.5px] text-ink-3">pasa de W a kW, kWh al año o amperios, y al revés</span>
        </span>
        <span aria-hidden="true" className={`text-ink-3 transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line px-4 pt-3 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label w-6">De</span>
            {from === 'VA' ? (
              <>
                <input className={`${INPUT} w-[70px]`} inputMode="decimal" aria-label="Voltios" value={volts} onChange={(event) => setVolts(event.target.value)} />
                <span className="text-[12.5px] text-ink-3">V ×</span>
                <input className={`${INPUT} w-[70px]`} inputMode="decimal" aria-label="Amperios" value={amps} onChange={(event) => setAmps(event.target.value)} />
                <span className="text-[12.5px] text-ink-3">A</span>
              </>
            ) : (
              <input className={`${INPUT} w-[110px]`} inputMode="decimal" aria-label="Cifra de partida" value={value} onChange={(event) => setValue(event.target.value)} />
            )}
            <UnitPicker label="Unidad de partida" value={from} onChange={setFrom} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label w-6">A</span>
            <UnitPicker label="Unidad del resultado" value={to} onChange={setTo} />
            {to === 'VA' && (
              <>
                <span className="text-[12.5px] text-ink-3">con</span>
                <input className={`${INPUT} w-[70px]`} inputMode="decimal" aria-label="Voltios del resultado" value={toVolts} onChange={(event) => setToVolts(event.target.value)} />
                <span className="text-[12.5px] text-ink-3">V</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-ink-3">=</span>
            <span role="status" className={`rounded-[7px] px-2.5 py-1.5 font-mono text-[14px] ${result === null ? 'bg-ink/6 text-ink-3' : 'bg-ok-soft text-ok-ink'}`}>
              {resultText}
            </span>
            <button type="button" onClick={swap} title="Dar la vuelta" aria-label="Dar la vuelta" className="rounded-chip border border-line-strong px-2.5 py-1.5 text-[13px] hover:bg-hover">
              ⇄
            </button>
            <button type="button" onClick={copy} disabled={result === null} className="rounded-chip border border-line-strong px-2.5 py-1.5 text-[12.5px] hover:bg-hover disabled:opacity-50">
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          {(to === 'kWhYear' || from === 'kWhYear') && (
            <p className="text-[12px] leading-normal text-ink-3">
              kWh al año es la potencia media por las 8760 horas del año: sólo tiene sentido para lo que está siempre enchufado.
            </p>
          )}
          {to === 'VA' && (
            <p className="text-[12px] leading-normal text-ink-3">
              Los mismos vatios pueden ser muchas combinaciones de voltios y amperios: dime los voltios (230 en un enchufe de casa, 12 o 5 en un cargador) y te digo los amperios.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
