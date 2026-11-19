import { useContract, useMe } from '../../api/hooks'
import { providerLabel } from '../../features/tarifa/providers'

/**
 * La línea bajo el nombre de la app: la casa, la comercializadora contratada y el peaje.
 * El nombre de la casa se cambia en Mi cuenta. Sin comercializadora en el contrato, no se pone.
 */
export function HouseholdLine({ className = '' }) {
  const contract = useContract()
  const me = useMe()
  const provider = contract.data ? providerLabel(contract.data.provider) : null
  const text = [me.data?.householdName || 'Casa', provider, 'peaje 2.0TD'].filter(Boolean).join(' · ')
  return (
    <div className={`truncate font-mono text-[11px] ${className}`} title={text}>
      {text}
    </div>
  )
}
