import { splitUnit } from '../../lib/splitUnit'

/** Cifra de cabecera: etiqueta pequeña en mayúsculas y valor en monoespaciada, con la unidad rebajada */
export function Stat({ label, value, accent = false, className = '' }) {
  const [figure, unit] = splitUnit(value)
  return (
    <div className={`text-right whitespace-nowrap max-sm:text-left ${className}`}>
      <div className={`label ${accent ? 'text-accent-ink' : ''}`}>{label}</div>
      <div className={`mt-1.5 font-mono text-[21px] leading-none tracking-[-0.01em] ${accent ? 'text-accent-ink' : 'text-ink'}`}>
        {figure}
        {unit && <span className="ml-[0.3em] text-[13px] tracking-normal opacity-70">{unit}</span>}
      </div>
    </div>
  )
}

/** Fila de cifras de cabecera: a la derecha del titular; en el móvil, una ficha a todo el ancho */
export function StatRow({ children }) {
  return (
    <div className="flex flex-wrap justify-end gap-x-7 gap-y-3 max-sm:grid max-sm:w-full max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-4 max-sm:rounded-panel max-sm:bg-surface-2 max-sm:px-4 max-sm:py-3.5">
      {children}
    </div>
  )
}
