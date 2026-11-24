import { useRef, useState } from 'react'
import { moveItem } from '../../lib/reorder'

/**
 * Arrastrar filas por su asa para ordenarlas. Las filas llevan `data-row-id` y el asa llama a
 * `start(id, event)` al pulsarla. Mientras se arrastra, `drag` dice cuánto se ha movido la fila
 * (`dy`) y dónde caería (`target`, índice en la lista sin ella). Al soltar se llama a
 * `onDrop(idsEnElNuevoOrden)` si el puesto ha cambiado.
 */
export function useRowDrag(ids, onDrop) {
  const [drag, setDrag] = useState(null)
  const rows = useRef([])

  function start(id, event) {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const container = handle.closest('[data-rows]')
    rows.current = [...container.querySelectorAll('[data-row-id]')].map((row) => {
      const box = row.getBoundingClientRect()
      return { id: row.dataset.rowId, middle: box.top + box.height / 2 }
    })
    const from = ids.indexOf(id)
    const origin = rows.current[from]
    const startY = event.clientY

    const targetFor = (dy) => {
      const center = origin.middle + dy
      // Cuántas de las otras filas quedan por encima del centro de la que se arrastra
      return rows.current.filter((row) => row.id !== id && row.middle < center).length
    }

    setDrag({ id, dy: 0, target: from })

    const move = (moveEvent) => {
      const dy = moveEvent.clientY - startY
      setDrag({ id, dy, target: targetFor(dy) })
    }
    const end = (endEvent) => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      const target = endEvent.type === 'pointercancel' ? from : targetFor(endEvent.clientY - startY)
      setDrag(null)
      if (target !== from) onDrop(moveItem(ids, from, target))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  return { drag, start }
}
