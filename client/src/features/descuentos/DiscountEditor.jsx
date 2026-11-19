import { useId, useState } from 'react'
import { errorMessage } from '../../api/client'
import { useDiscountCrud } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ConfirmDelete } from '../../components/ui/ConfirmDelete'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/ui/Notice'

const CHIP = 'rounded-control border px-3.5 py-2 text-[13px] max-sm:py-2.5 max-sm:text-[14px]'
const CHIP_ON = 'border-ink bg-ink text-white'
const CHIP_OFF = 'border-line-strong bg-control text-ink hover:border-ink/40'

/** «12,5» o «12.5» → 12.5; `null` si no es una cifra válida */
function parseAmount(text) {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() && Number.isFinite(value) && value >= 0 ? value : null
}

/** Apuntar o cambiar un descuento de un mes: nombre, en euros o en porcentaje, y una nota */
export function DiscountEditor({ entry, month, onClose }) {
  const crud = useDiscountCrud()
  const noteId = useId()
  const isEdit = !!entry
  const [label, setLabel] = useState(entry?.label ?? '')
  const [type, setType] = useState(entry?.type ?? 'amount')
  const [value, setValue] = useState(entry ? String(entry.value).replace('.', ',') : '')
  const [entryMonth, setEntryMonth] = useState((entry?.month ?? month).slice(0, 7))
  const [note, setNote] = useState(entry?.note ?? '')
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState(false)

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
    const amount = parseAmount(value)
    if (!label.trim()) return setProblem('Ponle un nombre al descuento')
    if (amount === null || amount === 0) return setProblem(type === 'amount' ? 'Escribe cuántos euros, por ejemplo 5 o 3,90' : 'Escribe el porcentaje, por ejemplo 10')
    if (type === 'percent' && amount > 100) return setProblem('Un porcentaje no puede pasar de 100')
    if (!entryMonth) return setProblem('Elige el mes')
    setProblem('')
    const input = { month: `${entryMonth}-01`, label: label.trim(), type, value: amount, note: note.trim() }
    if (isEdit) crud.save.mutate({ id: entry.id, changes: input }, { onSuccess: close })
    else crud.create.mutate(input, { onSuccess: close })
  }

  return (
    <Modal open onClose={close} title={isEdit ? 'Editar descuento' : 'Añadir descuento'}>
      <form onSubmit={submit}>
        <div className="mt-5 flex flex-col gap-3">
          <Field inline label="Nombre" placeholder="Promoción de bienvenida" maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} />
          <Field inline label="Mes" type="month" value={entryMonth} onChange={(event) => setEntryMonth(event.target.value)} />
        </div>

        <div className="label mt-5 mb-2.5">Cómo se descuenta</div>
        <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Tipo de descuento">
          {[
            ['amount', 'Una cantidad en euros'],
            ['percent', 'Un % de la energía'],
          ].map(([option, text]) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={type === option}
              onClick={() => setType(option)}
              className={`${CHIP} ${type === option ? CHIP_ON : CHIP_OFF}`}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Field
            inline
            mono
            label={type === 'amount' ? 'Euros' : 'Porcentaje'}
            inputMode="decimal"
            placeholder={type === 'amount' ? '5,00' : '10'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>

        <label htmlFor={noteId} className="label mt-5 mb-2.5 block">
          Nota
        </label>
        <input
          id={noteId}
          maxLength={200}
          placeholder="p. ej. código del cupón, hasta cuándo dura"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-chip border border-control-line bg-control px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-4 hover:border-ink/35 max-sm:text-base"
        />
        <p className="mt-2 text-[12px] leading-normal text-ink-3">
          Baja la estimación de la factura de ese mes. Si se repite todos los meses, mejor ponlo en el contrato.
        </p>

        {message && (
          <div className="mt-3">
            <ErrorNotice>{message}</ErrorNotice>
          </div>
        )}

        {confirming && isEdit ? (
          <ConfirmDelete
            warning="Deja de contar en ese mes y en su estimación."
            pending={pending}
            onConfirm={() => crud.remove.mutate(entry.id, { onSuccess: close })}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="mt-6 flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={pending}>
              Guardar
            </Button>
            {isEdit && (
              <Button variant="danger" disabled={pending} onClick={() => setConfirming(true)}>
                Eliminar
              </Button>
            )}
            <Button variant="quiet" onClick={close}>
              Cancelar
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
