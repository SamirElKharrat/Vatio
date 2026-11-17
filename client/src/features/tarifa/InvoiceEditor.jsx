import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { useInvoiceCrud } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ConfirmDelete } from '../../components/ui/ConfirmDelete'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/ui/Notice'
import { datesBetween } from '../../domain/time'
import { isDateISO } from '../../lib/dates'
import { PROVIDERS } from './providers'

/** Lee una cifra escrita con coma o punto decimal; `null` si no es un número */
function parseNumber(text) {
  const clean = text.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(clean) ? parseFloat(clean) : null
}

const show = (value) => (value === undefined ? '' : String(value).replace('.', ','))

/** Diálogo para escribir a mano los datos de una factura */
export function InvoiceEditor({ invoice, onClose }) {
  const crud = useInvoiceCrud()
  const [provider, setProvider] = useState(invoice?.provider ?? null)
  const [from, setFrom] = useState(invoice?.from ?? '')
  const [to, setTo] = useState(invoice?.to ?? '')
  const [days, setDays] = useState(invoice ? String(invoice.days) : '')
  const [total, setTotal] = useState(show(invoice?.total))
  const [kwh, setKwh] = useState(show(invoice?.kwh))
  const [punta, setPunta] = useState(show(invoice?.kwhByBand?.punta))
  const [llano, setLlano] = useState(show(invoice?.kwhByBand?.llano))
  const [valle, setValle] = useState(show(invoice?.kwhByBand?.valle))
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState(false)

  const pending = crud.create.isPending || crud.save.isPending || crud.remove.isPending
  const serverError = crud.create.error ?? crud.save.error ?? crud.remove.error
  const message = problem || (serverError ? errorMessage(serverError) : '')
  const countedDays = isDateISO(from) && isDateISO(to) && to >= from ? datesBetween(from, to).length : null

  function submit(event) {
    event.preventDefault()
    if (!isDateISO(from) || !isDateISO(to)) return setProblem('Indica el primer y el último día del periodo facturado')
    if (to < from) return setProblem('El último día debe ser igual o posterior al primero')

    const billedDays = days.trim() ? parseNumber(days) : countedDays
    if (!billedDays || !Number.isInteger(billedDays)) return setProblem('Escribe los días facturados como un número entero')
    const parsedTotal = parseNumber(total)
    if (parsedTotal === null) return setProblem('Escribe el total de la factura, por ejemplo 70,40')

    const bands = [punta, llano, valle].map((text) => (text.trim() ? parseNumber(text) : undefined))
    const filled = bands.filter((value) => value !== undefined)
    if (bands.includes(null) || (filled.length > 0 && filled.length < 3)) {
      return setProblem('Rellena los kWh de los tres tramos, o deja los tres en blanco')
    }
    const kwhByBand = filled.length === 3 ? { punta: bands[0], llano: bands[1], valle: bands[2] } : null
    const sum = kwhByBand ? kwhByBand.punta + kwhByBand.llano + kwhByBand.valle : null
    const parsedKwh = kwh.trim() ? parseNumber(kwh) : sum
    if (parsedKwh === null) return setProblem('Escribe los kWh consumidos, o los de cada tramo')

    setProblem('')
    const input = {
      provider,
      from,
      to,
      days: billedDays,
      total: parsedTotal,
      kwh: Math.round(parsedKwh * 1000) / 1000,
      kwhByBand,
      lines: invoice?.lines ?? [],
    }
    if (invoice) crud.save.mutate({ id: invoice.id, input }, { onSuccess: onClose })
    else crud.create.mutate(input, { onSuccess: onClose })
  }

  return (
    <Modal open onClose={onClose} title={invoice ? 'Editar factura' : 'Añadir factura'} width={480}>
      <form onSubmit={submit}>
        <div className="label mt-5 mb-2.5">Comercializadora</div>
        <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Comercializadora">
          {[...PROVIDERS, { id: null, name: 'Otra' }].map((option) => (
            <button
              key={option.name}
              type="button"
              role="radio"
              aria-checked={provider === option.id}
              onClick={() => setProvider(option.id)}
              className="choice"
            >
              {option.name}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <Field inline mono label="Primer día" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Field inline mono label="Último día" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <Field
            inline
            mono
            label="Días facturados"
            inputMode="numeric"
            placeholder={countedDays ? String(countedDays) : '30'}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
          <Field inline mono label="Total (€)" inputMode="decimal" placeholder="70,40" value={total} onChange={(event) => setTotal(event.target.value)} />
          <Field inline mono label="Consumo (kWh)" inputMode="decimal" placeholder="265,147" value={kwh} onChange={(event) => setKwh(event.target.value)} />
        </div>
        <p className="mt-2 text-[12px] leading-normal text-ink-3 sm:pl-[122px]">
          Los días son los que pone la factura; si lo dejas en blanco se cuentan del primer al último día
        </p>

        <div className="label mt-5 mb-2.5">kWh por tramo · si la factura los trae</div>
        <div className="grid grid-cols-3 gap-2.5">
          <Field mono label="Punta" inputMode="decimal" value={punta} onChange={(event) => setPunta(event.target.value)} />
          <Field mono label="Llano" inputMode="decimal" value={llano} onChange={(event) => setLlano(event.target.value)} />
          <Field mono label="Valle" inputMode="decimal" value={valle} onChange={(event) => setValle(event.target.value)} />
        </div>

        {message && (
          <div className="mt-3">
            <ErrorNotice>{message}</ErrorNotice>
          </div>
        )}

        {confirming && invoice ? (
          <ConfirmDelete
            warning="Se borrará esta factura. Tus usos apuntados no cambian."
            pending={pending}
            onConfirm={() => crud.remove.mutate(invoice.id, { onSuccess: onClose })}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="mt-6 flex gap-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={pending}>
              Guardar factura
            </Button>
            {invoice && (
              <Button variant="danger" onClick={() => setConfirming(true)}>
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
