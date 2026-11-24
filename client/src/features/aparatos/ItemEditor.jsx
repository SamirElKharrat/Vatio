import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { ConfirmDelete } from '../../components/ui/ConfirmDelete'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/ui/Notice'
import { ColorPicker } from '../../components/pickers'
import { parseDecimal } from '../../domain/power'
import { PowerInput } from './PowerInput'

/** Diálogo para dar de alta o cambiar un aparato o un consumo fijo: nombre, vatios, un dato más y color */
export function ItemEditor(props) {
  const [name, setName] = useState(props.initial.name)
  const [watts, setWatts] = useState(props.initial.watts)
  // Modo «kWh por uso»: para lo que no gasta sus vatios todo el rato (lavadora, microondas, vitro)
  const [perUse, setPerUse] = useState(!!props.initial.kwhPerUse)
  const [kwhPerUse, setKwhPerUse] = useState(props.initial.kwhPerUse ? String(props.initial.kwhPerUse).replace('.', ',') : '')
  const [extra, setExtra] = useState(props.initial.extra ?? '')
  const [color, setColor] = useState(props.initial.color)
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState(false)

  function submit(event) {
    event.preventDefault()
    if (!name.trim()) return setProblem('Ponle un nombre')
    if (!watts || watts > 100000) return setProblem('Escribe la potencia, por ejemplo 1200 W o 1,2 kW')
    const perUseKwh = perUse ? parseDecimal(kwhPerUse) : null
    if (perUse && (!perUseKwh || perUseKwh > 100)) return setProblem('Escribe los kWh de cada uso, por ejemplo 0,9')
    const extraProblem = props.validateExtra?.(extra)
    if (extraProblem) return setProblem(extraProblem)
    setProblem('')
    props.onSave({ name: name.trim(), watts, color, extra: extra.trim(), kwhPerUse: perUse ? perUseKwh : null })
  }

  const message = problem || (props.error ? errorMessage(props.error) : '')

  return (
    <Modal open onClose={props.onClose} title={props.title}>
      <form onSubmit={submit}>
        <div className="mt-5 flex flex-col gap-3">
          <Field inline label="Nombre" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          <PowerInput initialWatts={props.initial.watts} onChange={setWatts} />
          <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-start max-sm:gap-1.5">
            <span className="w-[110px] flex-none text-[13px] text-ink-2">Cómo gasta</span>
            <div className="flex flex-wrap gap-[3px] rounded-chip bg-ink/8 p-[3px]" role="radiogroup" aria-label="Cómo gasta">
              {[
                [false, 'Según los W'],
                [true, 'kWh por uso'],
              ].map(([option, text]) => (
                <button
                  key={text}
                  type="button"
                  role="radio"
                  aria-checked={perUse === option}
                  onClick={() => setPerUse(option)}
                  className={`rounded-[6px] px-2.5 py-1.5 text-[12.5px] leading-none ${perUse === option ? 'bg-control text-ink shadow-raised' : 'text-ink-2 hover:text-ink'}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          {perUse && (
            <>
              <Field inline mono label="Cada uso (kWh)" inputMode="decimal" placeholder="0,9" value={kwhPerUse} onChange={(event) => setKwhPerUse(event.target.value)} />
              <p className="-mt-1.5 text-[12px] leading-normal text-ink-3 sm:pl-[122px]">
                Lo pone el manual o la etiqueta energética (kWh por ciclo). Los W de arriba siguen contando para el aviso de
                potencia. Si cada programa gasta distinto, cámbialo al apuntar cada uso.
              </p>
            </>
          )}
          {props.extraLabel && (
            <Field
              inline
              label={props.extraLabel}
              placeholder={props.extraPlaceholder}
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
            />
          )}
        </div>
        {props.extraHint && <p className="mt-2 text-[12px] leading-normal text-ink-3 sm:pl-[122px]">{props.extraHint}</p>}

        <div className="label mt-5 mb-2.5">Color</div>
        <ColorPicker value={color} onChange={setColor} />

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
