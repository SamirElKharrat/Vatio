import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { ConfirmDelete } from '../../components/ui/ConfirmDelete'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/ui/Notice'
import { HuePicker } from '../../components/pickers'

/** Diálogo para dar de alta o cambiar un aparato o un consumo fijo: nombre, vatios, un dato más y color */
export function ItemEditor(props) {
  const [name, setName] = useState(props.initial.name)
  const [watts, setWatts] = useState(String(props.initial.watts))
  const [extra, setExtra] = useState(props.initial.extra)
  const [hue, setHue] = useState(props.initial.hue)
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState(false)

  function submit(event) {
    event.preventDefault()
    const parsedWatts = Number(watts.trim())
    if (!name.trim()) return setProblem('Ponle un nombre')
    if (!Number.isInteger(parsedWatts) || parsedWatts < 1) return setProblem('Escribe los vatios como un número entero, por ejemplo 1200')
    const extraProblem = props.validateExtra?.(extra)
    if (extraProblem) return setProblem(extraProblem)
    setProblem('')
    props.onSave({ name: name.trim(), watts: parsedWatts, hue, extra: extra.trim() })
  }

  const message = problem || (props.error ? errorMessage(props.error) : '')

  return (
    <Modal open onClose={props.onClose} title={props.title}>
      <form onSubmit={submit}>
        <div className="mt-5 flex flex-col gap-3">
          <Field inline label="Nombre" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          <Field
            inline
            mono
            label="Potencia (W)"
            inputMode="numeric"
            placeholder="1200"
            value={watts}
            onChange={(event) => setWatts(event.target.value)}
          />
          <Field
            inline
            label={props.extraLabel}
            placeholder={props.extraPlaceholder}
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
          />
        </div>
        {props.extraHint && <p className="mt-2 text-[12px] leading-normal text-ink-3 sm:pl-[122px]">{props.extraHint}</p>}

        <div className="label mt-5 mb-2.5">Color</div>
        <HuePicker value={hue} onChange={setHue} />

        {message && (
          <div className="mt-3">
            <ErrorNotice>{message}</ErrorNotice>
          </div>
        )}

        {confirming ? (
          <ConfirmDelete
            warning={props.deleteWarning}
            pending={props.pending}
            onConfirm={props.onDelete}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="mt-6 flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={props.pending}>
              Guardar
            </Button>
            {props.isEdit && (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Eliminar
              </Button>
            )}
            <Button variant="quiet" onClick={props.onClose}>
              Cancelar
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
