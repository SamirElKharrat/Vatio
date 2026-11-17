import { useState } from 'react'

/** Escribe la cifra con coma decimal; quita los ceros finales que sobren por encima de `minDecimals` */
function format(value, decimals, minDecimals) {
  let text = value.toFixed(decimals)
  while (minDecimals < decimals && text.endsWith('0') && text.length - text.indexOf('.') - 1 > minDecimals) {
    text = text.slice(0, -1)
  }
  // Sin decimales que mostrar no debe quedar la coma suelta
  return text.replace(/\.$/, '').replace('.', ',')
}

/** Cifra editable en línea, con su unidad detrás. Admite coma o punto decimal. */
export function NumberInput({ value, onCommit, label, unit, decimals = 0, minDecimals = decimals, min = 0, max = Infinity, width = 78 }) {
  // Mientras se escribe manda el texto; al salir del campo vuelve a mostrarse el valor guardado
  const [draft, setDraft] = useState(null)
  const invalid = draft !== null && parse(draft, decimals, min, max) === null

  return (
    <span className="inline-flex items-center gap-[9px]">
      <input
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        aria-label={label}
        aria-invalid={invalid}
        value={draft ?? format(value, decimals, minDecimals)}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          setDraft(event.target.value)
          // Se avisa de cada número válido, aunque coincida con `value`: al escribir deprisa
          // `value` puede ir un paso por detrás y la última cifra se perdería
          const parsed = parse(event.target.value, decimals, min, max)
          if (parsed !== null) onCommit(parsed)
        }}
        onBlur={() => setDraft(null)}
        // En el móvil la letra sube a 16 px (por debajo, Safari amplía la página) y el campo crece con ella
        style={{ '--w': `${width}px` }}
        className={`w-(--w) rounded-[8px] border bg-control px-[9px] py-[7px] text-right font-mono text-[13px] text-ink shadow-[inset_0_1px_1px_rgb(38_33_27/0.04)] max-sm:w-[calc(var(--w)*1.18)] max-sm:py-[9px] max-sm:text-base ${invalid ? 'border-danger-ink' : 'border-control-line hover:border-ink/35'}`}
      />
      <span className="font-mono text-[11.5px] whitespace-nowrap text-ink-3">{unit}</span>
    </span>
  )
}

function parse(text, decimals, min, max) {
  const clean = text.trim().replace(',', '.')
  if (!/^\d+(\.\d*)?$/.test(clean)) return null
  const factor = 10 ** decimals
  const value = Math.round(parseFloat(clean) * factor) / factor
  return value >= min && value <= max ? value : null
}

/**
 * Texto editable en línea. Igual que `NumberInput`, mientras se escribe manda lo tecleado:
 * si el campo dependiera sólo del valor guardado, al escribir deprisa se perderían letras.
 */
export function TextInput({ value, onCommit, label, placeholder, maxLength, className = '' }) {
  const [draft, setDraft] = useState(null)
  const shown = draft ?? value
  return (
    <input
      type="text"
      aria-label={label}
      aria-invalid={shown.trim() === ''}
      placeholder={placeholder}
      maxLength={maxLength}
      value={shown}
      onChange={(event) => {
        setDraft(event.target.value)
        onCommit(event.target.value)
      }}
      onBlur={() => setDraft(null)}
      className={`min-w-0 flex-1 rounded-[8px] border border-control-line bg-control px-[9px] py-[7px] text-[13px] text-ink shadow-[inset_0_1px_1px_rgb(38_33_27/0.04)] hover:border-ink/35 aria-invalid:border-danger-ink max-sm:py-[9px] max-sm:text-base ${className}`}
    />
  )
}
