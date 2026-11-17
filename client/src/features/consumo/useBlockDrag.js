import { useEffect, useRef, useState } from 'react'
import { snapQuarter } from '../../domain/time'

// Hace falta moverse esto, o mantener pulsado este tiempo, para que cuente como arrastre
const MOVE_THRESHOLD_PX = 3
const HOLD_MS = 100

/**
 * Arrastre de un bloque sobre la pista de 24 h, con ratón, dedo o lápiz.
 * `move` desplaza el bloque; `start` y `end` tiran de sus bordes. Todo se ajusta a cuartos de hora.
 *
 * Cada pulsación pasa por estas fases:
 *
 *   pressed ─(se mueve más de 3 px, o pasan 100 ms)─▶ dragging
 *   pressed o dragging ─(suelta sin haberse movido)─▶ onTap
 *   dragging ─(suelta tras moverse)─▶ onDrop, si la posición ha cambiado
 *   cualquiera ─(Esc, el navegador cancela, otra pulsación o la vista se cierra)─▶ nada cambia
 *
 * `drag` sólo tiene valor en `dragging`: es la posición provisional que pinta la vista.
 * Sólo cuenta el puntero que empezó: un segundo dedo no mueve el bloque.
 */
export function useBlockDrag({ onDrop, onTap }) {
  const [drag, setDrag] = useState(null)
  // Cómo cortar la pulsación en curso sin aplicar nada
  const abort = useRef(null)

  useEffect(() => () => abort.current?.(), [])

  function begin(usage, mode, event) {
    if (event.button !== 0) return
    const track = event.currentTarget.closest('[data-track]')
    if (!track) return
    event.preventDefault()
    event.stopPropagation()
    abort.current?.()

    const pointerId = event.pointerId
    const width = track.getBoundingClientRect().width
    const x0 = event.clientX
    const end0 = usage.start + usage.hours
    let phase = 'pressed'
    let moved = false
    let current = { start: usage.start, hours: usage.hours }

    const startDragging = () => {
      phase = 'dragging'
      setDrag({ id: usage.id, mode, ...current })
    }
    const timer = setTimeout(startDragging, HOLD_MS)

    const onMove = (ev) => {
      if (ev.pointerId !== pointerId) return
      const dx = ev.clientX - x0
      if (!moved && Math.abs(dx) > MOVE_THRESHOLD_PX) {
        moved = true
        clearTimeout(timer)
        phase = 'dragging'
      }
      if (phase !== 'dragging') return

      const deltaHours = (dx / width) * 24
      if (mode === 'move') {
        current = { start: clamp(snapQuarter(usage.start + deltaHours), 0, 24 - usage.hours), hours: usage.hours }
      } else if (mode === 'start') {
        const start = clamp(snapQuarter(usage.start + deltaHours), 0, end0 - 0.25)
        current = { start, hours: end0 - start }
      } else {
        current = { start: usage.start, hours: clamp(snapQuarter(usage.hours + deltaHours), 0.25, 24 - usage.start) }
      }
      setDrag({ id: usage.id, mode, ...current })
    }

    const stop = () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      abort.current = null
    }
    const cancel = () => {
      stop()
      setDrag(null)
    }
    const onUp = (ev) => {
      if (ev.pointerId !== pointerId) return
      cancel()
      if (!moved) onTap(usage)
      else if (current.start !== usage.start || current.hours !== usage.hours) onDrop(usage, current.start, current.hours)
    }
    const onCancel = (ev) => {
      if (ev.pointerId === pointerId) cancel()
    }
    const onKey = (ev) => {
      if (ev.key === 'Escape') cancel()
    }

    abort.current = cancel
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
  }

  return { drag, begin }
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
