import { useId, useState } from 'react'
import { errorMessage } from '../../api/client'
import { useFixedLoadCrud } from '../../api/hooks'
import { DevicePicker } from '../../components/pickers'
import { Button } from '../../components/ui/Button'
import { ConfirmDelete } from '../../components/ui/ConfirmDelete'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice, InfoNotice } from '../../components/ui/Notice'
import { DeviceEditor } from '../aparatos/DeviceEditor'

/**
 * Diálogo para marcar un aparato como consumo fijo (enchufado las 24 h) o cambiar su nota.
 * Al crear se elige el aparato entre los que aún no son fijos, o se da de alta uno ahí mismo.
 * Para cambiar los vatios, el nombre o el color de un fijo se edita su aparato.
 */
export function FixedLoadEditor({ load, home, onClose, onEditDevice }) {
  const crud = useFixedLoadCrud()
  const noteId = useId()
  const isEdit = !!load
  const fixedIds = new Set(home.fixedLoads.map((item) => item.deviceId))
  const candidates = home.devices.filter((device) => !fixedIds.has(device.id))
  const [deviceId, setDeviceId] = useState(load?.deviceId ?? '')
  const [note, setNote] = useState(load?.note ?? '')
  const [creatingDevice, setCreatingDevice] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [problem, setProblem] = useState('')

  const pending = crud.create.isPending || crud.save.isPending || crud.remove.isPending
  const serverError = crud.create.error ?? crud.save.error ?? crud.remove.error
  const message = problem || (serverError ? errorMessage(serverError) : '')

  function close() {
    crud.create.reset()
    crud.save.reset()
    crud.remove.reset()
    onClose()
  }

  function submit(event) {
    event.preventDefault()
    if (!isEdit && !deviceId) return setProblem('Elige el aparato que está siempre enchufado')
    setProblem('')
    if (isEdit) crud.save.mutate({ id: load.id, changes: { note: note.trim() } }, { onSuccess: close })
    else crud.create.mutate({ deviceId, note: note.trim() }, { onSuccess: close })
  }

  return (
    <Modal open onClose={close} title={isEdit ? `Consumo fijo · ${load.name}` : 'Añadir consumo fijo'}>
      <form onSubmit={submit}>
        {isEdit ? (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-control bg-surface-2 px-3.5 py-3">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium">{load.name}</div>
              <div className="mt-0.5 font-mono text-[12px] text-ink-3">{load.watts} W de media, las 24 h</div>
            </div>
            <Button size="sm" onClick={() => onEditDevice(load.deviceId)}>
              Editar aparato
            </Button>
          </div>
        ) : (
          <>
            <div className="label mt-5 mb-2.5">Aparato</div>
            <DevicePicker
              devices={candidates}
              value={deviceId}
              onChange={(id) => {
                setDeviceId(id)
                setProblem('')
              }}
              onCreate={() => setCreatingDevice(true)}
            />
            <div className="mt-3">
              <InfoNotice>
                El aparato pasa a contar como consumo fijo: se suma solo todo el día y deja de salir al apuntar usos y
                rutinas. Sus vatios deben ser la media de las 24 h, no el pico al arrancar.
              </InfoNotice>
            </div>
          </>
        )}

        <label htmlFor={noteId} className="label mt-5 mb-2.5 block">
          Nota
        </label>
        <input
          id={noteId}
          maxLength={200}
          placeholder="p. ej. arranca por ciclos, media 45 W"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-chip border border-control-line bg-control px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-4 hover:border-ink/35 max-sm:text-base"
        />

        {message && (
          <div className="mt-3">
            <ErrorNotice>{message}</ErrorNotice>
          </div>
        )}

        {confirming && isEdit ? (
          <ConfirmDelete
            warning="Dejará de sumarse a todos los días, también a los pasados. El aparato no se borra: vuelve a salir al apuntar usos."
            pending={pending}
            onConfirm={() => crud.remove.mutate(load.id, { onSuccess: close })}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={pending}>
              {isEdit ? 'Guardar' : 'Añadir consumo fijo'}
            </Button>
            {isEdit && (
              <Button variant="danger" disabled={pending} onClick={() => setConfirming(true)}>
                Dejar de contar como fijo
              </Button>
            )}
            <Button variant="quiet" onClick={close}>
              Cancelar
            </Button>
          </div>
        )}
      </form>

      {creatingDevice && (
        <DeviceEditor
          devices={home.devices}
          onSaved={(device) => {
            setDeviceId(device.id)
            setProblem('')
          }}
          onClose={() => setCreatingDevice(false)}
        />
      )}
    </Modal>
  )
}
