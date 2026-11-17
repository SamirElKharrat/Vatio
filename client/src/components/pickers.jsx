import { HUES } from '../lib/hues'

const CHIP = 'rounded-control border px-3 py-2 text-[13px] leading-tight max-sm:px-3.5 max-sm:py-2.5 max-sm:text-[14px]'
const CHIP_ON = 'border-ink bg-ink text-white'
const CHIP_OFF = 'border-line-strong bg-control text-ink hover:border-ink/40 hover:bg-surface'

/** Elegir un aparato entre los de la casa */
export function DevicePicker({ devices, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Aparato">
      {devices.map((device) => (
        <button
          key={device.id}
          type="button"
          role="radio"
          aria-checked={device.id === value}
          onClick={() => onChange(device.id)}
          className={`${CHIP} ${device.id === value ? CHIP_ON : CHIP_OFF}`}
        >
          {device.name}
        </button>
      ))}
    </div>
  )
}

const DAYS = [
  ['L', 'Lunes'],
  ['M', 'Martes'],
  ['X', 'Miércoles'],
  ['J', 'Jueves'],
  ['V', 'Viernes'],
  ['S', 'Sábado'],
  ['D', 'Domingo'],
]

/** Elegir días de la semana; 0 = lunes */
export function WeekdayPicker({ value, onChange }) {
  const toggle = (day) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))
  return (
    <div className="flex gap-1.5" role="group" aria-label="Días de la semana">
      {DAYS.map(([letter, name], day) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          aria-pressed={value.includes(day)}
          onClick={() => toggle(day)}
          className={`size-9 rounded-chip border font-mono text-xs font-medium max-sm:size-11 max-sm:flex-1 max-sm:text-[13px] ${value.includes(day) ? CHIP_ON : CHIP_OFF}`}
        >
          {letter}
        </button>
      ))}
    </div>
  )
}

const swatch = (hue) => `oklch(0.63 0.125 ${hue})`

/** Elegir el color con el que se pinta un aparato o un consumo fijo */
export function HuePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {HUES.map((hue, i) => (
        <button
          key={hue}
          type="button"
          role="radio"
          aria-checked={hue === value}
          aria-label={`Color ${i + 1}`}
          onClick={() => onChange(hue)}
          className={`size-8 rounded-[8px] outline-offset-2 hover:scale-108 max-sm:size-10 ${hue === value ? 'outline-2 outline-ink' : ''}`}
          style={{ background: swatch(hue) }}
        />
      ))}
    </div>
  )
}
