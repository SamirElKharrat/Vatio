import { useId } from 'react'

// En el móvil el texto sube a 16 px: por debajo, Safari amplía la página al tocar el campo
const INPUT_CLASS =
  'w-full min-w-0 rounded-chip border border-control-line bg-control px-3 py-2.5 text-[14px] text-ink shadow-[inset_0_1px_1px_rgb(38_33_27/0.04)] hover:border-ink/35 disabled:bg-surface-2 disabled:text-ink-3 max-sm:py-3 max-sm:text-base'

/** Campo de texto con su etiqueta, encima o a la izquierda */
export function Field({ label, hint, mono = false, inline = false, className = '', id, ...props }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const input = <input id={inputId} className={`${INPUT_CLASS} ${mono ? 'font-mono' : ''}`} {...props} />

  if (inline) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <label htmlFor={inputId} className="w-[110px] flex-none text-[13px] text-ink-2">
          {label}
        </label>
        {input}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {input}
      {hint && <p className="text-[12px] leading-normal text-ink-3">{hint}</p>}
    </div>
  )
}
