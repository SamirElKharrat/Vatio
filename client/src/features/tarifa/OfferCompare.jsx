import { useState } from 'react'
import { NumberInput } from '../../components/ui/NumberInput'
import { approxEur, eur, kwh } from '../../domain/format'
import { estimateInvoice } from '../../domain/invoice'
import { BAND_NAME } from '../consumo/colors'

const STORAGE_KEY = 'vatios.oferta'

/** La oferta se recuerda en este navegador; no forma parte del contrato */
function loadOffer(contract) {
  const fallback = {
    mode: 'fija',
    fixedPrice: contract.fixedPrice,
    prices: contract.prices,
    powerKw: contract.power.puntaLlano.kw,
    powerPricePuntaLlano: contract.power.puntaLlano.pricePerKwDay,
    powerPriceValle: contract.power.valle.pricePerKwDay,
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback
  } catch {
    return fallback
  }
}

function Line({ label, children }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line py-2">
      <span className="flex-1 text-[13px] text-ink-2">{label}</span>
      {children}
    </div>
  )
}

/** Comparar el contrato con otra oferta, usando un consumo real */
export function OfferCompare({ contract, bases }) {
  const [offer, setOfferState] = useState(() => loadOffer(contract))
  const [basisId, setBasisId] = useState(bases[0].id)
  const basis = bases.find((item) => item.id === basisId) ?? bases[0]

  function setOffer(changes) {
    const next = { ...offer, ...changes }
    setOfferState(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Sin almacenamiento la oferta sólo dura hasta recargar
    }
  }

  // La oferta se calcula con los mismos cargos e impuestos del contrato y sin sus descuentos
  const offerContract = {
    ...contract,
    mode: offer.mode,
    fixedPrice: offer.fixedPrice,
    prices: offer.prices,
    power: {
      puntaLlano: { kw: offer.powerKw, pricePerKwDay: offer.powerPricePuntaLlano },
      valle: { kw: offer.powerKw, pricePerKwDay: offer.powerPriceValle },
    },
    discounts: [],
  }
  const current = estimateInvoice(contract, basis.days, basis.kwhByBand).total
  const withOffer = estimateInvoice(offerContract, basis.days, basis.kwhByBand).total
  const delta = withOffer - current
  const perYear = (Math.abs(delta) / basis.days) * 365
  const same = Math.abs(delta) < 0.005

  return (
    <div className="rounded-panel border border-line-strong bg-control p-5 shadow-raised max-sm:p-4">
      <div className="label">Comparar con otra oferta</div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
        Mete los precios que te ofrecen y se calcula con tu consumo, con los mismos cargos e impuestos y sin
        descuentos.
      </p>

      {bases.length > 1 && (
        <div className="mt-4 flex gap-[3px] rounded-chip bg-ink/8 p-[3px]" role="radiogroup" aria-label="Consumo para comparar">
          {bases.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === basis.id}
              onClick={() => setBasisId(item.id)}
              className="segment"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 font-mono text-[11.5px] leading-snug text-ink-3">{basis.detail}</p>

      <div className="mt-4 mb-2 flex gap-[3px] rounded-chip bg-ink/8 p-[3px]" role="radiogroup" aria-label="Tipo de oferta">
        {(
          [
            ['fija', 'Precio fijo'],
            ['tramos', 'Por tramos'],
          ]
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={offer.mode === mode}
            onClick={() => setOffer({ mode })}
            className="segment"
          >
            {label}
          </button>
        ))}
      </div>

      {offer.mode === 'fija' ? (
        <Line label="Energía">
          <NumberInput label="Energía de la oferta" unit="€/kWh" width={84} decimals={6} minDecimals={4} max={10} value={offer.fixedPrice} onCommit={(fixedPrice) => setOffer({ fixedPrice })} />
        </Line>
      ) : (
        (['punta', 'llano', 'valle']).map((band) => (
          <Line key={band} label={`Energía en ${BAND_NAME[band].toLowerCase()}`}>
            <NumberInput
              label={`Energía en ${BAND_NAME[band].toLowerCase()} de la oferta`}
              unit="€/kWh"
              width={84}
              decimals={6}
              minDecimals={3}
              max={10}
              value={offer.prices[band]}
              onCommit={(price) => setOffer({ prices: { ...offer.prices, [band]: price } })}
            />
          </Line>
        ))
      )}
      <Line label="Potencia contratada">
        <NumberInput label="Potencia de la oferta" unit="kW" width={84} decimals={3} minDecimals={2} max={100} value={offer.powerKw} onCommit={(powerKw) => setOffer({ powerKw })} />
      </Line>
      <Line label="Potencia punta-llano">
        <NumberInput label="Precio de potencia punta-llano de la oferta" unit="€/kW día" width={84} decimals={6} minDecimals={4} max={10} value={offer.powerPricePuntaLlano} onCommit={(powerPricePuntaLlano) => setOffer({ powerPricePuntaLlano })} />
      </Line>
      <Line label="Potencia valle">
        <NumberInput label="Precio de potencia valle de la oferta" unit="€/kW día" width={84} decimals={6} minDecimals={4} max={10} value={offer.powerPriceValle} onCommit={(powerPriceValle) => setOffer({ powerPriceValle })} />
      </Line>

      <div className="mt-2 flex items-baseline justify-between border-t border-line-strong pt-4">
        <span className="text-[13px] text-ink-2">Con tu contrato (estimado)</span>
        <span className="font-mono text-[13.5px] text-ink-2">{eur(current)}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-[13px] text-ink-2">Con esa oferta (estimado)</span>
        <span className="font-mono text-[22px] leading-none tracking-[-0.01em]">{eur(withOffer)}</span>
      </div>
      <div className={`mt-4 rounded-control px-4 py-3.5 ${same ? 'bg-surface-2 text-ink-2' : delta < 0 ? 'bg-ok-soft text-ok-ink' : 'bg-danger-soft text-danger-ink'}`}>
        <div className="text-[14px] font-medium">
          {same ? 'Sale igual' : delta < 0 ? `Ahorrarías ${approxEur(-delta)} en ${basis.days} días` : `Pagarías ${approxEur(delta)} más en ${basis.days} días`}
        </div>
        {!same && (
          <div className="mt-1.5 font-mono text-[12px] leading-snug opacity-85">
            unos {eur(perYear)} al año a este ritmo · {kwh(basis.kwhByBand.punta + basis.kwhByBand.llano + basis.kwhByBand.valle, 0)}
          </div>
        )}
      </div>
    </div>
  )
}
