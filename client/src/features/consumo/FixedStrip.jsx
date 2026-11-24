import { Link } from 'react-router'
import { approxEur, kwh } from '../../domain/format'
import { deviceColor } from './colors'

/**
 * Los consumos fijos de la casa, nombrados: no entran en la rejilla, pero se suman cada día.
 * `fixed` es lo que suman ese día (`daySummary(...).fixed`).
 */
export function FixedStrip({ fixedLoads, fixed, className = '' }) {
  if (fixedLoads.length === 0) return null
  const watts = fixedLoads.reduce((total, load) => total + load.watts, 0)
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Link to="/fijos" className="label mr-1 hover:text-ink" title="Cambiarlos en Fijos y rutinas">
        Siempre enchufados
      </Link>
      {fixedLoads.map((load) => (
        <span key={load.id} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-control py-[3px] pr-2.5 pl-2 text-[12px]">
          <span className="size-2 flex-none rounded-swatch" style={{ background: deviceColor(load.color) }} />
          {load.name}
          <span className="font-mono text-[11px] text-ink-3">{load.watts} W</span>
        </span>
      ))}
      <span className="ml-auto font-mono text-[12px] text-ink-2 max-sm:ml-0">
        {watts} W · {kwh(fixed.kwh)} · {approxEur(fixed.cost)} al día
      </span>
    </div>
  )
}

/** Una línea con los fijos que se suman, para Semana y Mes */
export function FixedLine({ fixedLoads }) {
  if (fixedLoads.length === 0) return null
  const names = fixedLoads.map((load) => load.name)
  return (
    <p className="mt-2 text-[12px] leading-normal text-ink-3">
      Incluye {names.length === 1 ? '1 consumo fijo' : `${names.length} consumos fijos`}: {names.join(', ')} ·{' '}
      <Link to="/fijos" className="underline underline-offset-2 hover:text-ink">
        Cambiarlos
      </Link>
    </p>
  )
}
