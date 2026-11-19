import { ESTIMATE_NOTE } from '../../domain/format'

/** Aviso de error junto al formulario o la zona que ha fallado */
export function ErrorNotice({ children, action }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-chip border border-danger-ink/15 bg-danger-soft px-3.5 py-3 text-[13px] leading-snug text-danger-ink"
    >
      <span>{children}</span>
      {action}
    </div>
  )
}

/** Aviso al pie de las pantallas con importes calculados: son estimaciones, no la factura */
export function EstimateNote({ className = '' }) {
  return (
    <p className={`flex items-baseline gap-2 text-[12px] leading-normal text-ink-3 ${className}`}>
      <span aria-hidden="true" className="font-mono">≈</span>
      <span>{ESTIMATE_NOTE}</span>
    </p>
  )
}

/** Nota informativa sobre fondo suave */
export function InfoNotice({ children }) {
  return <div className="rounded-control bg-surface-2 px-3.5 py-3 text-[12.5px] leading-normal text-ink-2">{children}</div>
}

/** Espera de datos: tres barras que laten, como un contador, y el texto de siempre */
export function Loading({ children = 'Cargando…', className = '' }) {
  return (
    <p role="status" className={`flex items-center gap-2.5 py-1 font-mono text-[11.5px] text-ink-3 ${className}`}>
      <span aria-hidden="true" className="flex h-3.5 items-end gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-full w-[3px] origin-bottom animate-breathe rounded-[1px] bg-accent"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </span>
      {children}
    </p>
  )
}
