import { errorMessage } from '../../api/client'
import { useHousehold, useInvoices } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ErrorNotice, Loading } from '../../components/ui/Notice'
import { periodSummary } from '../../domain/aggregates'
import { eur, kwh } from '../../domain/format'
import { estimateInvoice } from '../../domain/invoice'
import { datesBetween } from '../../domain/time'
import { monthRange, monthTitle, rangeLabel, todayISO } from '../../lib/dates'
import { ContractSection } from './ContractSection'
import { InvoiceSection } from './InvoiceSection'
import { OfferCompare } from './OfferCompare'

/** Estimación del mes en curso con el contrato, y el comparador de ofertas */
function Estimate({ home, invoices }) {
  const today = todayISO()
  const { from, to } = monthRange(today)
  const dates = datesBetween(from, to)
  const month = periodSummary(home, dates)
  const invoice = estimateInvoice(home.contract, dates.length, month.byBand)
  const rest = invoice.fees.total + invoice.electricityTax.amount + invoice.taxTotal

  // Para comparar ofertas vale lo apuntado este mes y, mejor aún, lo que midió el contador en una factura
  const bases = [
    ...invoices
      .filter((item) => item.kwhByBand)
      .slice(0, 1)
      .map((item) => ({
        id: item.id,
        label: 'Última factura',
        detail: `consumo medido del ${rangeLabel(item.from, item.to)} · ${kwh(item.kwh)}`,
        days: item.days,
        kwhByBand: item.kwhByBand,
      })),
    {
      id: 'mes',
      label: 'Mes apuntado',
      detail: `lo apuntado en ${monthTitle(today).toLowerCase()} · ${kwh(month.total.kwh)}`,
      days: dates.length,
      kwhByBand: month.byBand,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-panel bg-ink p-5">
        <div className="label text-white/65">Tu tarifa · estimación de {monthTitle(today).toLowerCase()}</div>
        <div className="mt-3 font-mono text-[30px] leading-none tracking-[-0.015em] text-white">{eur(invoice.total)}</div>
        <dl className="mt-4 text-[13px] text-white/75">
          <div className="flex items-baseline justify-between gap-3 border-t border-white/12 py-2">
            <dt>
              Energía <span className="font-mono text-[12px] text-white/55">· {kwh(month.total.kwh)}</span>
            </dt>
            <dd className="font-mono text-[12.5px] text-white">{eur(invoice.energy.total)}</dd>
          </div>
          {invoice.discounts.total > 0 && (
            <div className="flex items-baseline justify-between gap-3 border-t border-white/12 py-2">
              <dt>Descuentos</dt>
              <dd className="font-mono text-[12.5px] text-white">−{eur(invoice.discounts.total)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 border-t border-white/12 py-2">
            <dt>Potencia</dt>
            <dd className="font-mono text-[12.5px] text-white">{eur(invoice.power.total)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-white/12 py-2">
            <dt>Cargos e impuestos</dt>
            <dd className="font-mono text-[12.5px] text-white">{eur(rest)}</dd>
          </div>
        </dl>
        <p className="border-t border-white/12 pt-3 text-[12px] leading-normal text-white/60">
          {home.contract.mode === 'fija' ? 'Precio fijo' : 'Por tramos 2.0TD'} · incluye consumos fijos y rutinas de todo
          el mes
        </p>
      </div>
      <OfferCompare contract={home.contract} bases={bases} />
    </div>
  )
}

/** Pestaña Tarifa y factura */
export function TarifaPage() {
  const { from, to } = monthRange(todayISO())
  const { home, error, refetch } = useHousehold(from, to)
  const invoices = useInvoices()

  const failure = error ?? invoices.error
  if (failure) {
    return (
      <ErrorNotice
        action={
          <Button size="sm" onClick={() => (refetch(), invoices.refetch())}>
            Reintentar
          </Button>
        }
      >
        {errorMessage(failure)}
      </ErrorNotice>
    )
  }
  if (!home || !invoices.data) return <Loading />

  return (
    <div className="flex max-w-[1240px] flex-col gap-9">
      <InvoiceSection invoices={invoices.data} />
      <div className="h-px bg-line-strong" />
      <div className="grid items-start gap-x-10 gap-y-9 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ContractSection contract={home.contract} />
        <Estimate home={home} invoices={invoices.data} />
      </div>
    </div>
  )
}
