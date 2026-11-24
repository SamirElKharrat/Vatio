import { useDeviceCrud } from '../../api/hooks'
import { firstFreeColor } from '../../lib/palette'
import { ItemEditor } from './ItemEditor'

/**
 * Diálogo para dar de alta o cambiar un aparato. Se abre desde Aparatos y también desde cualquier
 * diálogo que elija un aparato (rutinas, usos, consumos fijos), para no tener que salir de ahí.
 *
 * - `device`: el aparato a cambiar; sin él, se crea uno nuevo.
 * - `devices`: los de la casa, para proponer un color que no esté cogido.
 * - `onSaved(device)`: se llama con el aparato guardado, ya con su `id`.
 * - `deleteWarning`: lo que se avisa al borrarlo; sólo se puede borrar si se pasa.
 */
export function DeviceEditor({ device, devices, onSaved, onClose, deleteWarning }) {
  const crud = useDeviceCrud()
  const isEdit = !!device

  // Al cerrar se olvida el error de un guardado anterior, para que no reaparezca al volver a abrir
  function close() {
    crud.create.reset()
    crud.save.reset()
    crud.remove.reset()
    onClose()
  }

  function save(values) {
    // La duración no se escribe aquí: el aparato recuerda la de su último uso apuntado (1:00 al empezar)
    const input = { name: values.name, watts: values.watts, color: values.color, kwhPerUse: values.kwhPerUse ?? null }
    if (!isEdit) input.defaultHours = 1
    const options = {
      onSuccess: (saved) => {
        crud.create.reset()
        crud.save.reset()
        onSaved?.(saved)
        onClose()
      },
    }
    if (isEdit) crud.save.mutate({ id: device.id, changes: input }, options)
    else crud.create.mutate(input, options)
  }

  return (
    <ItemEditor
      key={device?.id ?? 'new'}
      title={isEdit ? 'Editar aparato' : 'Añadir aparato'}
      isEdit={isEdit && !!deleteWarning}
      initial={
        isEdit
          ? { name: device.name, watts: device.watts, color: device.color, kwhPerUse: device.kwhPerUse }
          : { name: '', watts: 1000, color: firstFreeColor(devices.map((item) => item.color)) }
      }
      extraHint="Al apuntarlo con «+» se propone lo que duró la última vez."
      deleteWarning={deleteWarning}
      pending={crud.create.isPending || crud.save.isPending || crud.remove.isPending}
      error={crud.create.error ?? crud.save.error ?? crud.remove.error}
      onSave={save}
      onDelete={() => isEdit && crud.remove.mutate(device.id, { onSuccess: close })}
      onClose={close}
    />
  )
}
