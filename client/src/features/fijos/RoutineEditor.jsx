import { useId, useState } from 'react'
import { errorMessage } from '../../api/client'
import { useRoutineCrud } from '../../api/hooks'
import { DevicePicker, WeekdayPicker } from '../../components/pickers'
import { Button } from '../../components/ui/Button'
import { ConfirmDelete } from '../../components/ui/ConfirmDelete'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/ui/Notice'
import { formatHM, parseRange } from '../../domain/time'

/** Diálogo para crear o cambiar una rutina: qué aparato, a qué horas y qué días */
export function RoutineEditor({ routine, devices, onClose }) {
  const crud = useRoutineCrud()
  const noteId = useId()
  const [name, setName] = useState(routine?.name ?? '')
  const [deviceId, setDeviceId] = useState(routine?.deviceId ?? devices[0]?.id ?? '')
  const [from, setFrom] = useState(routine ? formatHM(routine.start) : '22:00')
  const [to, setTo] = useState(routine ? formatHM(routine.start + routine.hours) : '23:30')
  const [weekdays, setWeekdays] = useState(routine?.weekdays ?? [0, 1, 2, 3, 4])
  const [note, setNote] = useState(routine?.note ?? '')
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState(false)

  const pending = crud.create.isPending || crud.save.isPending || crud.remove.isPending
  const serverError = crud.create.error ?? crud.save.error ?? crud.remove.error
  const message = problem || (serverError ? errorMessage(serverError) : '')

  function submit(event) {
    event.preventDefault()
    const range = parseRange(from, to)
    if (!name.trim()) return setProblem('Ponle un nombre a la rutina')
    if ('error' in range) return setProblem('Revisa las horas (por ejemplo, 14:00 y 15:30)')
    if (!weekdays.length) return setProblem('Elige al menos un día de la semana')
    setProblem('')
    const input = { name: name.trim(), deviceId, ...range, weekdays, note: note.trim() }
    if (routine) crud.save.mutate({ id: routine.id, changes: input }, { onSuccess: onClose })
    else crud.create.mutate(input, { onSuccess: onClose })
  }

  return (
    <Modal open onClose={onClose} title={routine ? 'Editar rutina' : 'Nueva rutina'}>
      <form onSubmit={submit}>
        <div className="mt-5">
          <Field
            inline
            label="Nombre"
            placeholder="Termo por la tarde"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="label mt-5 mb-2.5">Aparato</div>
        <DevicePicker devices={devices} value={deviceId} onChange={setDeviceId} />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field mono label="Empieza a las" placeholder="14:00" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Field mono label="Termina a las" placeholder="15:30" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>

        <div className="label mt-5 mb-2.5">Días</div>
        <WeekdayPicker value={weekdays} onChange={setWeekdays} />

        <label htmlFor={noteId} className="label mt-5 mb-2.5 block">
          Observaciones
        </label>
        <textarea
          id={noteId}
          rows={2}
          maxLength={300}
          placeholder="p. ej. modo eco, no tocar el interruptor de la pared"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full resize-y rounded-chip border border-control-line bg-control px-3 py-2.5 text-[14px] leading-snug text-ink shadow-[inset_0_1px_1px_rgb(38_33_27/0.04)] placeholder:text-ink-4 hover:border-ink/35 max-sm:text-base"
        />

        {message && (
          <div className="mt-3">
            <ErrorNotice>{message}</ErrorNotice>
          </div>
        )}

        {confirming && routine ? (
          <ConfirmDelete
            warning="Dejará de apuntarse sola en todos los días, también en los pasados. Los usos que cambiaste a mano se quedan."
            pending={pending}
            onConfirm={() => crud.remove.mutate(routine.id, { onSuccess: onClose })}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="mt-6 flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={pending}>
              Guardar rutina
            </Button>
            {routine && (
              <Button variant="danger" disabled={pending} onClick={() => setConfirming(true)}>
                Eliminar
              </Button>
            )}
            <Button variant="quiet" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
