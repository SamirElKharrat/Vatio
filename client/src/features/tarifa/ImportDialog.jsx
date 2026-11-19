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
import { isValidDni, normalizeDni } from '../../lib/dni'
import { oneTimeSecret } from '../../lib/oneTimeSecret'
import { asksDni, asksPassword, breakdown, importStep } from './importFlow'
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
  const [dni, setDni] = useState('')
  const [showDni, setShowDni] = useState(false)
  const [updateContract, setUpdateContract] = useState(true)
  const [dragging, setDragging] = useState(false)

  const step = importStep({ provider, file, reading: parse.isPending, parsed: parse.data, error: parse.error })
  const dniOk = isValidDni(dni)
  // Con DISA, el PDF se elige después de escribir un DNI válido
  const canPick = !!provider && (provider !== 'disa' || dniOk)

  /**
   * Lee el PDF. La contraseña o el DNI viajan en un contenedor de un solo uso y se borran de la
   * pantalla en este mismo momento: si no abren el PDF, se vuelven a pedir con el campo vacío.
   */
  function read(nextFile, nextProvider, secret) {
    setFile(nextFile)
    setPassword('')
    setDni('')
    setShowDni(false)
    parse.mutate({ file: nextFile, provider: nextProvider, secret: secret ? oneTimeSecret(secret) : undefined })
  }

  function pick(nextFile) {
    if (!nextFile || !canPick) return
    read(nextFile, provider, provider === 'disa' ? normalizeDni(dni) : undefined)
  }

  function submitDni(event) {
    event.preventDefault()
    if (file && dniOk) read(file, 'disa', normalizeDni(dni))
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
    setDni('')
    setShowDni(false)
  }

  // Paso 3: revisar lo leído
  if (step.name === 'review') {
    const { parsed } = step
    const bands = parsed.kwhByBand ?? { punta: 0, llano: 0, valle: parsed.kwh }
    const rebuilt = estimateInvoice(parsed.contract, parsed.days, bands, oneOffFees(parsed))
    const check = rebuilt.total
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
          {!matches && (
            <table className="mt-3 w-full text-[12.5px]">
              <caption className="sr-only">Diferencia por concepto</caption>
              <thead>
                <tr className="text-left text-ink-3">
                  <th className="py-1.5 font-normal">Concepto</th>
                  <th className="py-1.5 text-right font-normal">En la factura</th>
                  <th className="py-1.5 text-right font-normal">Rehecho</th>
                </tr>
              </thead>
              <tbody>
                {breakdown(parsed, rebuilt).map((row) => (
                  <tr key={row.label} className={`border-t border-line ${row.differs ? 'font-medium text-gap-ink' : 'text-ink-2'}`}>
                    <td className="py-1.5 pr-2">{row.label}</td>
                    <td className="py-1.5 text-right font-mono">{eur(row.read)}</td>
                    <td className="py-1.5 text-right font-mono">{eur(row.rebuilt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
                setDni('')
                setPassword('')
                if (parse.error) startOver()
              }}
              className="choice"
            >
              {option.name}
            </button>
          ))}
        </div>

        {asksDni(step, provider) && (
          <form onSubmit={submitDni} className="mt-5 flex flex-col gap-3" autoComplete="off">
            <div className="label">2 · DNI del titular</div>
            <div className="rounded-control border border-line-strong bg-surface-2 px-3.5 py-3 text-[12.5px] leading-normal text-ink-2">
              <p className="font-medium text-ink">Las facturas de DISA vienen protegidas con el DNI del titular.</p>
              <p className="mt-1.5">
                Lo usamos <strong className="font-medium text-ink">sólo para abrir este PDF, una vez</strong>. No se guarda en
                ningún sitio: ni en tu cuenta, ni en la base de datos, ni en los registros del servidor, ni en este navegador.
                En cuanto se lee la factura, el DNI se borra.
              </p>
            </div>
            {step.name !== 'pickFile' && <ErrorNotice>{errorMessage(parse.error)}</ErrorNotice>}
            <div className="flex items-end gap-2">
              <Field
                className="flex-1"
                label="DNI o NIE del titular"
                type={showDni ? 'text' : 'password'}
                name="pdf-unlock-code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                placeholder="12345678Z"
                data-1p-ignore="true"
                data-lpignore="true"
                value={dni}
                onChange={(event) => setDni(event.target.value)}
              />
              <Button onClick={() => setShowDni((shown) => !shown)} aria-pressed={showDni} className="max-sm:min-h-[46px]">
                {showDni ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
            {dni && !dniOk && (
              <p className="text-[12px] leading-normal text-ink-3">Revisa los números y la letra: así no abre el PDF.</p>
            )}
            {file && (
              <Button type="submit" variant="primary" disabled={!dniOk}>
                Leer la factura
              </Button>
            )}
          </form>
        )}

        <div className="label mt-5 mb-2.5">{provider === 'disa' ? '3' : '2'} · El PDF</div>
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
            setDragging(canPick)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-3 rounded-panel border border-dashed px-4 py-7 text-center ${dragging ? 'border-accent bg-accent-soft' : 'border-ink/30 bg-control'} ${canPick ? '' : 'opacity-60'}`}
        >
          {step.name === 'reading' ? (
            <>
              <Loading>Leyendo…</Loading>
              <div className="font-mono text-[12px] text-ink-3">{file?.name}</div>
            </>
          ) : (
            <>
              <div className="text-[13.5px] text-ink-2">
                {!provider
                  ? 'Elige primero la comercializadora'
                  : canPick
                    ? 'Arrastra aquí el PDF o elígelo'
                    : 'Escribe primero el DNI del titular'}
              </div>
              <Button variant="primary" disabled={!canPick} onClick={() => fileInput.current?.click()}>
                Elegir PDF
              </Button>
              {file && <div className="font-mono text-[12px] text-ink-3">{file.name}</div>}
            </>
          )}
        </div>

        {asksPassword(step, provider) && (
          <form onSubmit={submitPassword} className="mt-3.5 flex flex-col gap-3">
            <Field
              label="Contraseña del PDF"
              type="password"
              autoComplete="off"
              autoFocus
              name="pdf-unlock-code"
              data-1p-ignore="true"
              data-lpignore="true"
              hint="Sólo se usa para abrir este PDF, una vez. No se guarda en ningún sitio y se borra en cuanto se lee la factura."
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
                      // La contraseña o el DNI ya se borraron al enviarlos: no se reutilizan con otro lector.
                      // Si es de DISA, se pide su DNI y se vuelve a leer el mismo PDF desde ahí.
                      if (step.detected === 'disa') parse.reset()
                      else read(file, step.detected)
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
