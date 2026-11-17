import { useRef, useState } from 'react'
import { errorMessage } from '../../api/client'
import { useApplyParsedInvoice, useParseInvoice } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice, InfoNotice, Loading } from '../../components/ui/Notice'
import { eur, kwh } from '../../domain/format'
import { estimateInvoice, oneOffFees } from '../../domain/invoice'
import { rangeLabel } from '../../lib/dates'
import { asksPassword, importStep } from './importFlow'
import { PROVIDERS, providerName } from './providers'

const price = (value, unit) => `${String(value).replace('.', ',')} ${unit}`

/** Lo que se ha leído, en renglones de «dato: valor» para revisarlo antes de guardar */
function summary(parsed) {
  const { contract } = parsed
  const sumOf = (kind) =>
    parsed.lines.filter((line) => line.kind === kind).reduce((total, line) => total + line.amount, 0)
  const rows = [
    { label: 'Comercializadora', value: providerName(parsed.provider) ?? 'Otra' },
    { label: 'Periodo facturado', value: `${rangeLabel(parsed.from, parsed.to)} · ${parsed.days} días` },
    {
      label: 'Potencia punta-llano',
      value: `${price(contract.power.puntaLlano.kw, 'kW')} · ${price(contract.power.puntaLlano.pricePerKwDay, '€/kW día')}`,
    },
    {
      label: 'Potencia valle',
      value: `${price(contract.power.valle.kw, 'kW')} · ${price(contract.power.valle.pricePerKwDay, '€/kW día')}`,
    },
    { label: 'Energía consumida', value: kwh(parsed.kwh, 3) },
    {
      label: 'Precio de la energía',
      value:
        contract.mode === 'fija'
          ? `${price(contract.fixedPrice, '€/kWh')} a cualquier hora`
          : `punta ${price(contract.prices.punta, '')}· llano ${price(contract.prices.llano, '')}· valle ${price(contract.prices.valle, '€/kWh')}`,
    },
  ]
  if (parsed.kwhByBand) {
    rows.push({
      label: 'Consumo por tramo',
      value: `punta ${kwh(parsed.kwhByBand.punta, 1)} · llano ${kwh(parsed.kwhByBand.llano, 1)} · valle ${kwh(parsed.kwhByBand.valle, 1)}`,
    })
  }
  if (sumOf('discount')) rows.push({ label: 'Descuentos', value: '−' + eur(Math.abs(sumOf('discount'))) })
  if (sumOf('fee')) rows.push({ label: 'Bono social y alquiler', value: eur(sumOf('fee')) })
  if (sumOf('oneoff')) rows.push({ label: 'Cargos que no se repiten', value: eur(sumOf('oneoff')) })
  rows.push({ label: 'Impuesto eléctrico', value: price(contract.electricityTaxPct, '%') })
  rows.push({ label: 'Total factura', value: eur(parsed.total) })
  return rows
}

/** Subir el PDF de una factura: se elige la comercializadora, se lee y se revisa antes de guardar */
export function ImportDialog({ onClose, onImported, onManual }) {
  const parse = useParseInvoice()
  const apply = useApplyParsedInvoice()
  const fileInput = useRef(null)
  const [provider, setProvider] = useState(null)
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [updateContract, setUpdateContract] = useState(true)
  const [dragging, setDragging] = useState(false)

  const step = importStep({ provider, file, reading: parse.isPending, parsed: parse.data, error: parse.error })

  function read(nextFile, nextProvider, nextPassword) {
    setFile(nextFile)
    parse.mutate({ file: nextFile, provider: nextProvider, password: nextPassword })
  }

  function pick(nextFile) {
    if (!nextFile || !provider) return
    setPassword('')
    read(nextFile, provider)
  }

  function onDrop(event) {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files[0])
  }

  function submitPassword(event) {
    event.preventDefault()
    if (file && provider && password) read(file, provider, password)
  }

  function startOver() {
    parse.reset()
    apply.reset()
    setFile(null)
    setPassword('')
  }

  // Paso 3: revisar lo leído
  if (step.name === 'review') {
    const { parsed } = step
    const bands = parsed.kwhByBand ?? { punta: 0, llano: 0, valle: parsed.kwh }
    const check = estimateInvoice(parsed.contract, parsed.days, bands, oneOffFees(parsed)).total
    const matches = Math.abs(check - parsed.total) < 0.005
    const rows = summary(parsed)
    return (
      <Modal open onClose={onClose} title={file.name} aside={`${rows.length} datos encontrados`} width={520}>
        <div data-step={step.name}>
          <dl className="mt-4">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4 border-t border-line py-2">
                <dt className="flex-none text-[13px] text-ink-2">{row.label}</dt>
                <dd className="text-right font-mono text-[12.5px]">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className={`mt-4 rounded-control px-4 py-3 text-[13px] leading-normal ${matches ? 'bg-ok-soft text-ok-ink' : 'bg-gap text-gap-ink'}`}>
            {matches
              ? `Los datos cuadran: al rehacer la factura con ellos sale el mismo total, ${eur(parsed.total)}.`
              : `Al rehacer la factura con estos datos salen ${eur(check)}, no ${eur(parsed.total)}. Puede faltar algún concepto: revísalo después en el contrato.`}
          </div>
          {parsed.warnings.map((warning) => (
            <div key={warning} className="mt-2.5">
              <InfoNotice>{warning}</InfoNotice>
            </div>
          ))}

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13.5px] text-ink">
            <input
              type="checkbox"
              checked={updateContract}
              onChange={(event) => setUpdateContract(event.target.checked)}
              className="mt-0.5 size-4 flex-none accent-ink"
            />
            <span>
              Actualizar también la tarifa y el contrato
              <span className="mt-0.5 block text-[12.5px] leading-normal text-ink-3">
                Sustituye los precios, la potencia, los descuentos y los cargos que tienes ahora.
              </span>
            </span>
          </label>

          {apply.error && (
            <div className="mt-3">
              <ErrorNotice>{errorMessage(apply.error)}</ErrorNotice>
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={apply.isPending}
              onClick={() => apply.mutate({ parsed, updateContract }, { onSuccess: (invoice) => onImported(invoice, file.name) })}
            >
              {apply.isPending ? 'Guardando…' : 'Usar estos datos'}
            </Button>
            <Button onClick={startOver}>Descartar</Button>
          </div>
        </div>
      </Modal>
    )
  }

  // Pasos 1 y 2: elegir la comercializadora y subir el PDF
  return (
    <Modal open onClose={onClose} title="Subir el PDF de la factura" width={480}>
      <div data-step={step.name}>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
          La app lee la potencia, los precios, los kWh y el total. El PDF se lee y se descarta: sólo se guardan los datos.
        </p>

        <div className="label mt-5 mb-2.5">1 · ¿De qué comercializadora es?</div>
        <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Comercializadora">
          {PROVIDERS.map((option) => (
            <button
              key={option.name}
              type="button"
              role="radio"
              aria-checked={provider === option.id}
              disabled={step.name === 'reading'}
              onClick={() => {
                setProvider(option.id)
                if (parse.error) startOver()
              }}
              className="choice"
            >
              {option.name}
            </button>
          ))}
        </div>

        <div className="label mt-5 mb-2.5">2 · El PDF</div>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="PDF de la factura"
          onChange={(event) => {
            pick(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(!!provider)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-3 rounded-panel border border-dashed px-4 py-7 text-center ${dragging ? 'border-accent bg-accent-soft' : 'border-ink/30 bg-control'} ${provider ? '' : 'opacity-60'}`}
        >
          {step.name === 'reading' ? (
            <>
              <Loading>Leyendo…</Loading>
              <div className="font-mono text-[12px] text-ink-3">{file?.name}</div>
            </>
          ) : (
            <>
              <div className="text-[13.5px] text-ink-2">
                {provider ? 'Arrastra aquí el PDF o elígelo' : 'Elige primero la comercializadora'}
              </div>
              <Button variant="primary" disabled={!provider} onClick={() => fileInput.current?.click()}>
                Elegir PDF
              </Button>
              {file && <div className="font-mono text-[12px] text-ink-3">{file.name}</div>}
            </>
          )}
        </div>

        {asksPassword(step) && (
          <form onSubmit={submitPassword} className="mt-3.5 flex flex-col gap-3">
            <Field
              label="Contraseña del PDF"
              type="password"
              autoComplete="off"
              autoFocus
              hint="Sólo se usa para abrir el archivo; no se guarda. Suele ser el NIF del titular."
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {step.name === 'wrongPassword' && <ErrorNotice>{errorMessage(parse.error)}</ErrorNotice>}
            <Button type="submit" variant="primary" disabled={!password}>
              Leer la factura
            </Button>
          </form>
        )}

        {(step.name === 'wrongProvider' || step.name === 'failed') && (
          <div className="mt-3.5">
            <ErrorNotice
              action={
                step.name === 'wrongProvider' && file ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setProvider(step.detected)
                      // Si ya se había escrito la contraseña para abrirlo, se reutiliza
                      read(file, step.detected, password || undefined)
                    }}
                  >
                    Leer como {providerName(step.detected)}
                  </Button>
                ) : undefined
              }
            >
              {errorMessage(parse.error)}
            </ErrorNotice>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Button className="flex-1" onClick={onManual}>
            Escribir los datos a mano
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
