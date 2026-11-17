import { useState } from 'react'
import { useHousehold } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { Loading } from '../../components/ui/Notice'
import { periodSummary } from '../../domain/aggregates'
import { eur, kwh } from '../../domain/format'
import { estimateInvoice, oneOffFees } from '../../domain/invoice'
import { datesBetween } from '../../domain/time'
import { rangeLabel } from '../../lib/dates'
import { BAND_BG, BAND_NAME, deviceColor } from '../consumo/colors'
import { ImportDialog } from './ImportDialog'
import { InvoiceEditor } from './InvoiceEditor'
import { providerName } from './providers'

const BANDS = ['punta', 'llano', 'valle']

/** Consumo de la factura por tramo; sin desglose sólo se puede calcular con precio fijo */
function billedBands(invoice, contract) {
  if (invoice.kwhByBand) return invoice.kwhByBand
  return contract.mode === 'fija' ? { punta: 0, llano: 0, valle: invoice.kwh } : null
}

function Comparison({ invoice }) {
  const { home } = useHousehold(invoice.from, invoice.to)
  if (!home) return <Loading className="mt-5">Cargando lo apuntado en ese periodo…</Loading>

  const dates = datesBetween(invoice.from, invoice.to)
  const logged = periodSummary(home, dates)
  // Los cargos sueltos de esta factura se suman a los dos lados: no dependen de lo apuntado
  const extras = oneOffFees(invoice)
  const estimated = estimateInvoice(home.contract, invoice.days, logged.byBand, extras).total
  const gap = invoice.total - estimated
  const over = gap < -0.005
  const pct = invoice.total > 0 ? Math.min(100, Math.max(0, (estimated / invoice.total) * 100)) : 0

  const bands = billedBands(invoice, home.contract)
  const withContract = bands ? estimateInvoice(home.contract, invoice.days, bands, extras).total : null
  const contractGap = withContract === null ? null : Math.round((invoice.total - withContract) * 100) / 100

  const weeks = Array.from({ length: Math.ceil(dates.length / 7) }, (_, i) => ({
    label: `S${i + 1}`,
    kwh: logged.days.slice(i * 7, i * 7 + 7).reduce((total, day) => total + day.total.kwh, 0),
  }))
  const weekMax = Math.max(0.001, ...weeks.map((week) => week.kwh))

  const spenders = [
    ...home.devices.map((device) => ({
      name: device.name,
      cost: logged.byDevice[device.id]?.cost ?? 0,
      color: deviceColor(device.hue),
    })),
    { name: 'Consumos fijos', cost: logged.fixed.cost, color: 'rgba(0,0,0,.35)' },
  ]
    .filter((item) => item.cost > 0)
    .sort((a, b) => b.cost - a.cost)
  const spendMax = Math.max(0.0001, ...spenders.map((item) => item.cost))

  return (
    <div className="mt-6 grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 basis-40 rounded-panel bg-ink px-5 py-[18px]">
            <div className="label text-white/65">Facturado</div>
            <div className="mt-3 font-mono text-[27px] leading-none tracking-[-0.015em] text-white">{eur(invoice.total)}</div>
          </div>
          <div className="flex-1 basis-40 rounded-panel bg-surface-2 px-5 py-[18px]">
            <div className="label">Apuntado</div>
            <div className="mt-3 font-mono text-[27px] leading-none tracking-[-0.015em]">{eur(estimated)}</div>
          </div>
          <div className={`flex-1 basis-40 rounded-panel border px-5 py-[18px] ${over ? 'border-punta-line bg-punta text-punta-ink' : 'border-gap-line bg-gap text-gap-ink'}`}>
            <div className="label text-current">{over ? 'Te pasas de la factura' : 'Sin explicar'}</div>
            <div className="mt-3 font-mono text-[27px] leading-none tracking-[-0.015em]">{eur(Math.abs(gap))}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-3.5 overflow-hidden rounded-[5px] bg-ink/8">
            <div className="h-full rounded-[5px] bg-heat-mid" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-[12px] text-ink-3">
            <span>{pct.toFixed(1).replace('.', ',')} % de la factura explicado por tus apuntes</span>
            <span>
              {kwh(logged.total.kwh)} apuntados de {kwh(invoice.kwh)}
            </span>
          </div>
        </div>

        <div className={`mt-5 rounded-control px-4 py-3 text-[13px] leading-normal ${contractGap === 0 ? 'bg-valle text-ink' : 'bg-surface-2 text-ink-2'}`}>
          {withContract === null
            ? 'Para comprobar el contrato por tramos hacen falta los kWh de cada tramo de la factura.'
            : contractGap === 0
              ? `Tu contrato cuadra: con los precios de abajo y el consumo de la factura salen ${eur(withContract)}.`
              : `Con los precios de abajo y el consumo de la factura saldrían ${eur(withContract)}, ${eur(Math.abs(contractGap))} ${contractGap > 0 ? 'menos' : 'más'} de lo facturado. Revisa precios, descuentos y cargos.`}
        </div>

        {invoice.kwhByBand && (
          <>
            <div className="mt-7 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="label">kWh por tramo</span>
              <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink-3">
                <span className="h-1.5 w-4 rounded-swatch bg-ink" /> facturado
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink-3">
                <span className="h-1.5 w-4 rounded-swatch bg-heat-mid" /> apuntado
              </span>
            </div>
            {BANDS.map((band) => {
              const billed = invoice.kwhByBand[band]
              const max = Math.max(0.001, billed, logged.byBand[band])
              return (
                <div key={band} className="flex items-center gap-3 border-t border-line py-2.5">
                  <span className={`size-3.5 flex-none rounded-[4px] ${BAND_BG[band]}`} />
                  <span className="w-12 text-[13px]">{BAND_NAME[band]}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="h-1.5 rounded-swatch bg-ink" style={{ width: `${(billed / max) * 100}%` }} />
                    <div className="h-1.5 rounded-swatch bg-heat-mid" style={{ width: `${(logged.byBand[band] / max) * 100}%` }} />
                  </div>
                  <span className="w-[156px] text-right font-mono text-[12px] text-ink-2 max-sm:w-auto">
                    {kwh(billed, 1)} · {kwh(logged.byBand[band], 1)}
                  </span>
                </div>
              )
            })}
          </>
        )}

        {invoice.lines.length > 0 && (
          <details className="mt-7">
            <summary className="label cursor-pointer rounded-[4px] py-1 hover:text-ink">Los {invoice.lines.length} conceptos de la factura</summary>
            <dl className="mt-3">
              {invoice.lines.map((line, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 border-t border-line py-2">
                  <dt className="text-[13px] text-ink-2">{line.label}</dt>
                  <dd className="font-mono text-[12.5px]">{eur(line.amount)}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}

        <div className="label mt-8 mb-3.5">kWh apuntados por semana del periodo</div>
        <div className="flex h-[136px] max-w-[560px] items-end gap-4 border-b border-line-strong max-sm:gap-2.5">
          {weeks.map((week) => (
            <div key={week.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="font-mono text-[12.5px] font-medium">{week.kwh.toFixed(0)}</span>
              <div className="w-full rounded-t-[6px] bg-heat-bar" style={{ height: Math.round((week.kwh / weekMax) * 104) }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex max-w-[560px] gap-4 max-sm:gap-2.5" aria-hidden="true">
          {weeks.map((week) => (
            <span key={week.label} className="flex-1 text-center font-mono text-[11.5px] text-ink-3">
              {week.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <div className="label mb-3.5">Quién se lleva el dinero</div>
          {spenders.length === 0 && <p className="text-[13px] text-ink-2">No hay nada apuntado en ese periodo.</p>}
          {spenders.map((item) => (
            <div key={item.name} className="mb-3">
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate">{item.name}</span>
                <span className="font-mono text-[12.5px]">{eur(item.cost)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-swatch bg-ink/8">
                <div className="h-full rounded-swatch" style={{ width: `${(item.cost / spendMax) * 100}%`, background: item.color }} />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-panel bg-surface-2 p-[18px]">
          <div className="label">{over ? 'Te pasas de la factura' : 'Sin explicar'} · por qué</div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
            {over
              ? 'Apuntas más de lo que te han cobrado: revisa los vatios de los aparatos, los consumos fijos o alguna rutina que ya no uses.'
              : 'Lo que apuntas son aparatos que enciendes. El resto son consumos fijos que no has dado de alta y usos que no has apuntado.'}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
            {over
              ? 'Baja los vatios en Aparatos o quita rutinas hasta que lo apuntado cuadre con la factura.'
              : 'Da de alta más consumos fijos en «Fijos y rutinas» para cerrar la diferencia.'}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Lo que te han cobrado frente a lo que has apuntado en el mismo periodo */
export function InvoiceSection({ invoices }) {
  const [selectedId, setSelectedId] = useState(null)
  // Un solo diálogo a la vez: `null`, subir el PDF (`import`) o escribirla a mano (`edit`, con `invoice: null` si es nueva)
  const [dialog, setDialog] = useState(null)
  const openImport = () => setDialog({ kind: 'import' })
  const openEditor = (invoice) => setDialog({ kind: 'edit', invoice })
  const closeDialog = () => setDialog(null)
  const [importedFrom, setImportedFrom] = useState(null)
  const invoice = invoices.find((item) => item.id === selectedId) ?? invoices[0]

  return (
    <section>
      {!invoice ? (
        <div className="rounded-[14px] border border-line bg-surface-2 px-6 py-6 max-sm:px-5">
          <h2 className="text-[21px] leading-tight tracking-[-0.01em]">Empieza por tu última factura</h2>
          <p className="mt-2.5 max-w-[66ch] text-[13.5px] leading-relaxed text-ink-2">
            Sube el PDF de tu comercializadora y la app lee la potencia contratada, los precios, los kWh y el total. Con
            eso rellena la tarifa y el contrato de abajo y compara la factura con lo que has apuntado. También puedes
            escribirlo todo a mano.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={openImport}>
              Subir el PDF de la factura
            </Button>
            <Button onClick={() => openEditor(null)}>Escribirla a mano</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
            <div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="page-title">Factura del {rangeLabel(invoice.from, invoice.to)}</h2>
                <span className="font-mono text-[12px] text-ink-3">
                  {[providerName(invoice.provider), `${invoice.days} días`].filter(Boolean).join(' · ')}
                </span>
              </div>
              <p className="page-lead mt-2">Lo que te han cobrado frente a lo que has apuntado.</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => openEditor(invoice)}>
                Editar factura
              </Button>
              <Button size="sm" variant="soft" onClick={openImport}>
                Añadir otra
              </Button>
            </div>
          </div>

          {importedFrom && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-ok-ink/15 bg-ok-soft px-4 py-3 text-[13px] text-ok-ink">
              <span>
                Datos de <b className="font-medium">{importedFrom}</b> aplicados. Puedes seguir ajustándolos a mano abajo.
              </span>
              <Button size="sm" onClick={() => setImportedFrom(null)}>
                Cerrar
              </Button>
            </div>
          )}

          {invoices.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-[7px]" role="radiogroup" aria-label="Factura">
              {invoices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={item.id === invoice.id}
                  onClick={() => setSelectedId(item.id)}
                  className="choice font-mono text-[12px] max-sm:text-[13px]"
                >
                  {rangeLabel(item.from, item.to)}
                </button>
              ))}
            </div>
          )}

          <Comparison key={invoice.id} invoice={invoice} />
        </>
      )}

      {dialog?.kind === 'import' && (
        <ImportDialog
          onClose={closeDialog}
          onManual={() => openEditor(null)}
          onImported={(imported, fileName) => {
            closeDialog()
            setSelectedId(imported.id)
            setImportedFrom(fileName)
          }}
        />
      )}
      {dialog?.kind === 'edit' && (
        <InvoiceEditor
          key={dialog.invoice?.id ?? 'new'}
          invoice={dialog.invoice}
          onClose={closeDialog}
        />
      )}
    </section>
  )
}
