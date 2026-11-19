import { useEffect, useRef, useState } from 'react'
import { COLOR_FAMILIES, familyOf, PRESETS } from '../lib/palette'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'

const CHIP = 'rounded-control border px-3 py-2 text-[13px] leading-tight max-sm:px-3.5 max-sm:py-2.5 max-sm:text-[14px]'
const CHIP_ON = 'border-ink bg-ink text-white'
const CHIP_OFF = 'border-line-strong bg-control text-ink hover:border-ink/40 hover:bg-surface'

/**
 * Elegir un aparato entre los de la casa. Con `onCreate`, al final va «+ Nuevo aparato» para dar
 * de alta uno sin salir del diálogo en el que se está.
 */
export function DevicePicker({ devices, value, onChange, onCreate }) {
  return (
    <div className="flex flex-wrap gap-[7px]">
      {devices.length > 0 && (
        <div className="contents" role="radiogroup" aria-label="Aparato">
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
      )}
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className={`${CHIP} border-dashed border-ink/35 bg-transparent text-ink-2 hover:border-ink/60 hover:bg-control hover:text-ink`}
        >
          + Nuevo aparato
        </button>
      )}
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

const SWATCH = 'rounded-full outline-offset-2 transition-transform hover:scale-110'
const SWATCH_ON = 'outline-2 outline-ink'

/** Elegir el color de un aparato o un consumo fijo: unos pocos a mano y el «+» abre la paleta completa */
export function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  // El color actual va siempre el primero, aunque venga de la paleta grande
  const quick = [value, ...PRESETS.filter((color) => color !== value)].filter(Boolean).slice(0, 7)
  return (
    <>
      <div className="flex items-center gap-2.5 max-sm:grid max-sm:grid-cols-8 max-sm:gap-2" role="radiogroup" aria-label="Color">
        {quick.map((color, i) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={color === value}
            aria-label={i === 0 ? 'Color actual' : `Color ${i + 1}`}
            onClick={() => onChange(color)}
            className={`size-9 max-sm:aspect-square max-sm:size-auto max-sm:w-full ${SWATCH} ${color === value ? SWATCH_ON : ''}`}
            style={{ background: color }}
          />
        ))}
        <button
          type="button"
          aria-label="Más colores"
          title="Más colores"
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-full border border-line-strong bg-control text-ink-2 hover:border-ink/40 hover:text-ink max-sm:aspect-square max-sm:size-auto max-sm:w-full"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M8 2.5v11M2.5 8h11" />
          </svg>
        </button>
      </div>
      {open && (
        <PaletteDialog
          initial={value}
          onClose={() => setOpen(false)}
          onSelect={(color) => {
            onChange(color)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

/** Paleta completa: una página por familia, cada fila un color de oscuro a claro. En el móvil se pasa de página deslizando */
function PaletteDialog({ initial, onClose, onSelect }) {
  const [picked, setPicked] = useState(initial)
  const [page, setPage] = useState(() => familyOf(initial))
  const track = useRef(null)
  const tabs = useRef(null)

  // Abre en la página del color actual, sin animación
  useEffect(() => {
    let frame = 0
    const place = () => {
      // El portal del diálogo monta el contenido un fotograma después; hasta entonces no hay nada que mover
      const el = track.current
      if (!el || el.clientWidth === 0) {
        frame = requestAnimationFrame(place)
        return
      }
      el.scrollLeft = page * el.clientWidth
      centerTab(page, 'instant')
    }
    place()
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // La pestaña de la página visible siempre a la vista, también al pasar de página deslizando
  function centerTab(index, behavior = 'smooth') {
    const strip = tabs.current
    const tab = strip?.children[index]
    if (tab) strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior })
  }
  useEffect(() => centerTab(page), [page])

  function goTo(index) {
    setPage(index)
    track.current?.scrollTo({ left: index * track.current.clientWidth, behavior: 'smooth' })
  }

  function onScroll(event) {
    const el = event.currentTarget
    const index = Math.round(el.scrollLeft / el.clientWidth)
    if (index !== page) setPage(index)
  }

  return (
    <Modal open onClose={onClose} title="Seleccionar color" width={430}>
      <div ref={tabs} className="relative -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Familias de color">
        {COLOR_FAMILIES.map((family, i) => (
          <button
            key={family.name}
            type="button"
            role="tab"
            aria-selected={i === page}
            onClick={() => goTo(i)}
            className={`flex-none rounded-control border px-2.5 py-1.5 text-[12.5px] leading-tight max-sm:py-2 max-sm:text-[13px] ${i === page ? CHIP_ON : CHIP_OFF}`}
          >
            {family.name}
          </button>
        ))}
      </div>

      <div
        ref={track}
        onScroll={onScroll}
        className="mt-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {COLOR_FAMILIES.map((family, i) => (
          <div
            key={family.name}
            role="radiogroup"
            aria-label={family.name}
            aria-hidden={i !== page}
            className="grid w-full flex-none snap-start grid-cols-6 gap-x-3.5 gap-y-2.5 p-1 max-sm:gap-x-3"
          >
            {family.rows.flatMap((row, r) =>
              row.map((color, c) => (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  role="radio"
                  tabIndex={i === page ? 0 : -1}
                  aria-checked={color === picked}
                  aria-label={`${family.name}, fila ${r + 1}, tono ${c + 1} de ${row.length}`}
                  onClick={() => setPicked(color)}
                  onDoubleClick={() => onSelect(color)}
                  className={`aspect-square w-full ${SWATCH} ${color === picked ? SWATCH_ON : ''}`}
                  style={{ background: color }}
                />
              )),
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {COLOR_FAMILIES.map((family, i) => (
          <span key={family.name} className={`size-1.5 rounded-full ${i === page ? 'bg-ink' : 'bg-ink/20'}`} />
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2">
        <span className="size-[42px] flex-none rounded-control border border-line-strong max-sm:size-[46px]" style={{ background: picked }} aria-hidden />
        <Button variant="primary" className="flex-1" onClick={() => onSelect(picked)}>
          Seleccionar
        </Button>
        <Button variant="quiet" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  )
}
