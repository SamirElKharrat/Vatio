import { Button } from './Button'

/**
 * Segundo paso antes de borrar algo desde un diálogo: sustituye a los botones de guardar
 * mientras se confirma (editando → confirmando → borrado, o vuelta a editando).
 */
export function ConfirmDelete({ warning, pending, onConfirm, onCancel }) {
  return (
    <div className="mt-5 rounded-control border border-danger-ink/15 bg-danger-soft p-3.5">
      <p className="text-[13px] leading-snug text-danger-ink">{warning}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" className="flex-1" disabled={pending} onClick={onConfirm}>
          Sí, eliminar
        </Button>
        <Button onClick={onCancel}>No, volver</Button>
      </div>
    </div>
  )
}
