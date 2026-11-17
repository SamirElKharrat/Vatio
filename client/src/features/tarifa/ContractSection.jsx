import { errorMessage } from '../../api/client'
import { useUpdateContract } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ErrorNotice } from '../../components/ui/Notice'
import { NumberInput, TextInput } from '../../components/ui/NumberInput'
import { eur } from '../../domain/format'
import { dayBands } from '../../domain/tariff'
import { todayISO } from '../../lib/dates'
import { BAND_BG, BAND_NAME } from '../consumo/colors'
import { PROVIDERS } from './providers'

const BAND_HOURS = {
  valle: '00:00 – 08:00, fines de semana y festivos nacionales',
  llano: '08:00 – 10:00 · 14:00 – 18:00 · 22:00 – 24:00',
  punta: '10:00 – 14:00 y 18:00 – 22:00',
}

function Row({ swatch, title, sub, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line py-3.5">
      {swatch && <span className={`size-[22px] flex-none rounded-[6px] ring-1 ring-ink/8 ring-inset ${swatch}`} />}
      <div className="min-w-0 flex-1 basis-48">
        <div className="text-[14.5px]">{title}</div>
        <div className="mt-1 text-[12.5px] leading-snug text-ink-3">{sub}</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{children}</div>
    </div>
  )
}

const SectionLabel = ({ children }) => <div className="label mt-9 border-b border-line-strong pb-2.5">{children}</div>

/** El contrato: precios, potencia, descuentos, cargos e impuestos. Cada cambio recalcula toda la app. */
export function ContractSection({ contract }) {
  const { update, error, clearError } = useUpdateContract()
  // Cada cambio se calcula sobre el contrato más reciente (`current`), no sobre el de esta pintada
  const set = (changes) =>
    update((current) => ({ ...current, ...changes(current) }))
  const isFija = contract.mode === 'fija'
  const bands = dayBands(nextWeekday())

  const setPower = (term, changes) =>
    set((current) => ({ power: { ...current.power, [term]: { ...current.power[term], ...changes } } }))
  const setDiscount = (index, changes) =>
    set((current) => ({
      discounts: current.discounts.map((item, i) => (i === index ? ({ ...item, ...changes }) : item)),
    }))
  const setFee = (index, changes) =>
    set((current) => ({ dailyFees: current.dailyFees.map((item, i) => (i === index ? { ...item, ...changes } : item)) }))

  const modeButton = (mode, title, sub) => (
    <button
      type="button"
      role="radio"
      aria-checked={contract.mode === mode}
      onClick={() => set(() => ({ mode }))}
      className={`flex-1 basis-52 rounded-panel border px-[18px] py-4 text-left ${contract.mode === mode ? 'border-ink bg-ink text-white' : 'border-line-strong bg-control text-ink shadow-raised hover:border-ink/40'}`}
    >
      <div className="text-[14.5px] font-medium">{title}</div>
      <div className="mt-1.5 text-[12.5px] leading-snug opacity-75">{sub}</div>
    </button>
  )

  return (
    <section>
      <h2 className="page-title">Tarifa y contrato</h2>
      <p className="page-lead mt-2">
        Copia los datos de tu factura: todo se recalcula al instante y se guarda solo.
      </p>

      {error !== null && (
        <div className="mt-4">
          <ErrorNotice
            action={
              <Button size="sm" onClick={clearError}>
                Cerrar
              </Button>
            }
          >
            No se ha guardado el último cambio. {errorMessage(error)}
          </ErrorNotice>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-[7px]" role="radiogroup" aria-label="Comercializadora">
        <span className="mr-2 text-[13.5px] text-ink-2 max-sm:w-full">Comercializadora</span>
        {[...PROVIDERS, { id: null, name: 'Otra' }].map((option) => (
          <button
            key={option.name}
            type="button"
            role="radio"
            aria-checked={(contract.provider ?? null) === option.id}
            onClick={() => set(() => ({ provider: option.id }))}
            className="choice"
          >
            {option.name}
          </button>
        ))}
      </div>

      <div className="mt-5 mb-1.5 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Tipo de tarifa">
        {modeButton('fija', 'Precio fijo', 'El mismo €/kWh a todas las horas')}
        {modeButton('tramos', 'Por tramos · 2.0TD', 'Valle, llano y punta con precios distintos')}
      </div>

      {isFija ? (
        <Row swatch="bg-flat" title="Precio de la energía" sub="igual a cualquier hora del día">
          <NumberInput
            label="Precio de la energía"
            unit="€/kWh"
            width={92}
            decimals={6}
            minDecimals={4}
            max={10}
            value={contract.fixedPrice}
            onCommit={(fixedPrice) => set(() => ({ fixedPrice }))}
          />
        </Row>
      ) : (
        (['valle', 'llano', 'punta']).map((band) => (
          <Row key={band} swatch={BAND_BG[band]} title={BAND_NAME[band]} sub={BAND_HOURS[band]}>
            <NumberInput
              label={`Precio en ${BAND_NAME[band].toLowerCase()}`}
              unit="€/kWh"
              width={92}
              decimals={6}
              minDecimals={3}
              max={10}
              value={contract.prices[band]}
              onCommit={(price) => set((current) => ({ prices: { ...current.prices, [band]: price } }))}
            />
          </Row>
        ))
      )}

      <SectionLabel>Potencia contratada</SectionLabel>
      {(
        [
          ['puntaLlano', 'Punta y llano', 'P1 en la factura'],
          ['valle', 'Valle', 'P3 en la factura'],
        ]
      ).map(([term, title, hint]) => {
        const power = contract.power[term]
        return (
          <Row key={term} title={title} sub={`${hint} · ${eur(power.kw * power.pricePerKwDay * 30)} cada 30 días`}>
            <NumberInput
              label={`Potencia en ${title.toLowerCase()}`}
              unit="kW"
              width={72}
              decimals={3}
              minDecimals={2}
              max={100}
              value={power.kw}
              onCommit={(kw) => setPower(term, { kw })}
            />
            <NumberInput
              label={`Precio de la potencia en ${title.toLowerCase()}`}
              unit="€/kW día"
              width={92}
              decimals={6}
              minDecimals={4}
              max={10}
              value={power.pricePerKwDay}
              onCommit={(pricePerKwDay) => setPower(term, { pricePerKwDay })}
            />
          </Row>
        )
      })}

      <SectionLabel>Descuentos</SectionLabel>
      {contract.discounts.length === 0 && (
        <p className="border-b border-line py-3.5 text-[13px] text-ink-3">Sin descuentos.</p>
      )}
      {contract.discounts.map((discount, index) => (
        <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3">
          <TextInput
            label="Nombre del descuento"
            placeholder="Nombre del descuento"
            maxLength={80}
            className="basis-40"
            value={discount.label}
            onCommit={(label) => setDiscount(index, { label })}
          />
          <select
            aria-label="Tipo de descuento"
            value={discount.type}
            onChange={(event) =>
              setDiscount(index, event.target.value === 'percent' ? { type: 'percent', pct: 0 } : { type: 'amount', amount: 0 })
            }
            className="rounded-[8px] border border-control-line bg-control px-2 py-[7px] text-[13px] text-ink hover:border-ink/35 max-sm:py-[9px] max-sm:text-base"
          >
            <option value="percent">% de la energía</option>
            <option value="amount">€ por factura</option>
          </select>
          {discount.type === 'percent' ? (
            <NumberInput
              label="Porcentaje"
              unit="%"
              width={64}
              decimals={2}
              minDecimals={0}
              max={100}
              value={discount.pct}
              onCommit={(pct) => setDiscount(index, { pct })}
            />
          ) : (
            <NumberInput
              label="Importe"
              unit="€"
              width={64}
              decimals={2}
              max={100000}
              value={discount.amount}
              onCommit={(amount) => setDiscount(index, { amount })}
            />
          )}
          <Button size="sm" variant="quiet" onClick={() => set((current) => ({ discounts: current.discounts.filter((_, i) => i !== index) }))}>
            Quitar
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        className="mt-3"
        onClick={() => set((current) => ({ discounts: [...current.discounts, { label: 'Descuento', type: 'percent', pct: 0 }] }))}
      >
        + Añadir descuento
      </Button>

      <SectionLabel>Cargos por día</SectionLabel>
      {contract.dailyFees.length === 0 && (
        <p className="border-b border-line py-3.5 text-[13px] text-ink-3">Sin cargos diarios.</p>
      )}
      {contract.dailyFees.map((fee, index) => (
        <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3">
          <TextInput
            label="Nombre del cargo"
            placeholder="Nombre del cargo"
            maxLength={80}
            className="basis-40"
            value={fee.label}
            onCommit={(label) => setFee(index, { label })}
          />
          <NumberInput
            label={`Precio de ${fee.label}`}
            unit="€/día"
            width={84}
            decimals={6}
            minDecimals={4}
            max={10}
            value={fee.pricePerDay}
            onCommit={(pricePerDay) => setFee(index, { pricePerDay })}
          />
          <NumberInput
            label={`Impuesto de ${fee.label}`}
            unit="% IGIC/IVA"
            width={52}
            decimals={2}
            minDecimals={0}
            max={100}
            value={fee.taxPct}
            onCommit={(taxPct) => setFee(index, { taxPct })}
          />
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2">
            <input
              type="checkbox"
              checked={fee.inElectricityTaxBase}
              onChange={(event) => setFee(index, { inElectricityTaxBase: event.target.checked })}
              className="size-4 accent-ink"
            />
            paga impuesto eléctrico
          </label>
          <Button size="sm" variant="quiet" onClick={() => set((current) => ({ dailyFees: current.dailyFees.filter((_, i) => i !== index) }))}>
            Quitar
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        className="mt-3"
        onClick={() =>
          set((current) => ({
            dailyFees: [...current.dailyFees, { label: 'Cargo', pricePerDay: 0, inElectricityTaxBase: false, taxPct: 0 }],
          }))
        }
      >
        + Añadir cargo
      </Button>

      <SectionLabel>Impuestos</SectionLabel>
      <Row title="Impuesto eléctrico" sub="sobre potencia, energía y bono social, ya con descuentos">
        <NumberInput
          label="Impuesto eléctrico"
          unit="%"
          width={96}
          decimals={8}
          minDecimals={2}
          max={100}
          value={contract.electricityTaxPct}
          onCommit={(electricityTaxPct) => set(() => ({ electricityTaxPct }))}
        />
      </Row>
      <Row title="IGIC o IVA de la luz" sub="sobre potencia, energía e impuesto eléctrico">
        <NumberInput
          label="IGIC o IVA de la luz"
          unit="%"
          width={64}
          decimals={2}
          minDecimals={0}
          max={100}
          value={contract.supplyTaxPct}
          onCommit={(supplyTaxPct) => set(() => ({ supplyTaxPct }))}
        />
      </Row>

      <div className="mt-9">
        <div className="label mb-3">Cómo queda un día laborable con esta tarifa</div>
        <div className="flex h-[22px] overflow-hidden rounded-[5px] ring-1 ring-ink/8 ring-inset">
          {bands.map((band, hour) => (
            <div
              key={hour}
              title={`${String(hour).padStart(2, '0')}:00 · ${isFija ? 'precio fijo' : BAND_NAME[band]}`}
              className={`flex-1 ${isFija ? 'bg-flat' : BAND_BG[band]}`}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-3">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        <p className="mt-2.5 text-[12.5px] leading-normal text-ink-2">
          {isFija
            ? 'Tarifa fija: el mismo precio a cualquier hora.'
            : 'Valle 00–08 · Punta 10–14 y 18–22 · Llano el resto. Fines de semana y festivos nacionales, todo valle.'}
        </p>
      </div>
    </section>
  )
}

/** Un miércoles cualquiera: sirve para pintar los tramos de un día laborable sin que caiga en festivo */
function nextWeekday() {
  return todayISO().slice(0, 4) + '-03-' + String(firstWednesdayOfMarch(Number(todayISO().slice(0, 4)))).padStart(2, '0')
}

function firstWednesdayOfMarch(year) {
  const weekday = new Date(Date.UTC(year, 2, 1)).getUTCDay()
  return 1 + ((3 - weekday + 7) % 7)
}
