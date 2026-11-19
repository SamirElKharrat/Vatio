import { useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../api/client'
import { useContract, useDiscounts } from '../../api/hooks'
import { Chevron } from '../../components/layout/marks'
import { Button } from '../../components/ui/Button'
import { ErrorNotice, Loading } from '../../components/ui/Notice'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { eur } from '../../domain/format'
import { monthRange, monthYearTitle, shiftMonth, todayISO } from '../../lib/dates'
import { DiscountEditor } from './DiscountEditor'

const STEP =
  'grid size-10 place-items-center rounded-chip border border-line-strong bg-control text-ink-2 shadow-raised hover:border-ink/35 hover:text-ink'

/** «− 5,00 €» o «− 10 % de la energía» */
const amountLabel = (entry) =>
  entry.type === 'amount' ? `− ${eur(entry.value)}` : `− ${String(entry.value).replace('.', ',')} % de la energía`

/** Suma en euros de los descuentos en cantidad; los porcentajes dependen del consumo y van aparte */
function totals(entries) {
  const euros = entries.filter((entry) => entry.type === 'amount').reduce((sum, entry) => sum + entry.value, 0)
  const percents = entries.filter((entry) => entry.type === 'percent').length
  return { euros, percents }
}

function TotalTile({ label, entries }) {
  const { euros, percents } = totals(entries)
  return (
    <div className="flex-1 basis-40 rounded-panel bg-surface-2 px-[18px] py-4">
      <div className="label">{label}</div>
      <div className="mt-2.5 font-mono text-[22px] leading-none tracking-[-0.01em]">{euros ? `− ${eur(euros)}` : eur(0)}</div>
      <div className="mt-2 font-mono text-[12px] text-ink-3">
        {entries.length === 1 ? '1 descuento' : `${entries.length} descuentos`}
        {percents > 0 && ` · ${percents} en %`}
      </div>
    </div>
  )
}

/** Pestaña Descuentos: lo que se ha descontado cada mes, de las facturas y apuntado a mano */
export function DescuentosPage() {
  const [month, setMonth] = useState(() => monthRange(todayISO()).from)
  const [editing, setEditing] = useState(null)
  const year = month.slice(0, 4)
  const discounts = useDiscounts(`${year}-01-01`, `${year}-12-01`)
  const contract = useContract()

  const error = discounts.error ?? contract.error
  if (error) {
    return (
      <ErrorNotice
        action={
          <Button size="sm" onClick={() => (discounts.refetch(), contract.refetch())}>
            Reintentar
          </Button>
        }
      >
        {errorMessage(error)}
      </ErrorNotice>
    )
  }
  if (!discounts.data || !contract.data) return <Loading />

  const yearEntries = discounts.data.filter((entry) => entry.month.startsWith(year))
  const monthEntries = yearEntries.filter((entry) => entry.month === month)
  const thisMonth = monthRange(todayISO()).from

  return (
    <div className="flex max-w-[1080px] flex-col gap-7">
      <SectionHeader
        title="Descuentos"
        action={
          <Button variant="primary" onClick={() => setEditing('new')}>
            + Añadir descuento
          </Button>
        }
      >
        Lleva la cuenta de lo que te descuentan cada mes. Los de tus facturas se apuntan solos al subirlas; los demás (una
        promoción, un cupón) apúntalos aquí y bajarán la estimación de ese mes.
      </SectionHeader>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={STEP} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior" title="Mes anterior">
          <Chevron direction="left" />
        </button>
        <h3 className="min-w-[170px] text-center text-[17px] font-medium">{monthYearTitle(month)}</h3>
        <button type="button" className={STEP} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente" title="Mes siguiente">
          <Chevron />
        </button>
        {month !== thisMonth && (
          <Button size="sm" variant="quiet" onClick={() => setMonth(thisMonth)}>
            Volver a este mes
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <TotalTile label={`En ${monthYearTitle(month).toLowerCase()}`} entries={monthEntries} />
        <TotalTile label={`En todo ${year}`} entries={yearEntries} />
      </div>

      <section>
        <div className="label border-b border-line-strong pb-2.5">Descuentos del mes</div>
        {monthEntries.length === 0 && (
          <p className="border-b border-line py-4 text-[13.5px] text-ink-2">
            Ningún descuento en este mes. Si has usado alguno, añádelo con «+ Añadir descuento».
          </p>
        )}
        {monthEntries.map((entry) => (
          <div key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-3.5">
            <div className="min-w-0 flex-1 basis-56">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14.5px]">{entry.label}</span>
                <span
                  className={`rounded-[5px] px-1.5 py-[3px] font-mono text-[10.5px] leading-none ${entry.source === 'factura' ? 'bg-accent/10 text-accent-ink' : 'bg-ink/7 text-ink-2'}`}
                >
                  {entry.source === 'factura' ? 'De una factura' : 'A mano'}
                </span>
              </div>
              {entry.note && <div className="mt-1 text-[12px] leading-snug text-ink-3">{entry.note}</div>}
            </div>
            <span className="font-mono text-[13.5px] font-medium text-ok-ink">{amountLabel(entry)}</span>
            {entry.source === 'manual' ? (
              <Button size="sm" onClick={() => setEditing(entry)} aria-label={`Editar ${entry.label}`}>
                Editar
              </Button>
            ) : (
              <Link to="/tarifa" className="text-[12.5px] text-ink-3 underline underline-offset-2 hover:text-ink">
                Ver la factura
              </Link>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-panel border border-line-strong p-5">
        <div className="label">Descuentos del contrato · todos los meses</div>
        {contract.data.discounts.length === 0 ? (
          <p className="mt-2.5 text-[13px] text-ink-2">Tu contrato no tiene descuentos fijos.</p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {contract.data.discounts.map((discount, i) => (
              <li key={i} className="flex justify-between gap-3 text-[13.5px]">
                <span className="truncate">{discount.label}</span>
                <span className="font-mono text-[12.5px] text-ink-2">
                  {discount.type === 'percent' ? `− ${String(discount.pct).replace('.', ',')} % de la energía` : `− ${eur(discount.amount)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12px] leading-normal text-ink-3">
          Ya cuentan en todas las estimaciones; no hace falta apuntarlos aquí.{' '}
          <Link to="/tarifa" className="text-ink-2 underline underline-offset-2 hover:text-ink">
            Cambiarlos en Tarifa y factura
          </Link>
        </p>
      </section>

      {editing && (
        <DiscountEditor
          key={editing === 'new' ? 'new' : editing.id}
          entry={editing === 'new' ? null : editing}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
