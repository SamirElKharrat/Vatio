import { useContract } from '../../api/hooks'
import { providerLabel } from '../../features/tarifa/providers'

/**
 * La línea bajo el nombre de la app: la casa, la comercializadora contratada y el peaje.
 * Sin comercializadora en el contrato, se queda en «casa · peaje 2.0TD».
 */
export function HouseholdLine({ className = '' }) {
  const contract = useContract()
  const provider = contract.data ? providerLabel(contract.data.provider) : null
  const text = ['casa', provider, 'peaje 2.0TD'].filter(Boolean).join(' · ')
  return (
    <div className={`truncate font-mono text-[11px] ${className}`} title={text}>
      {text}
    </div>
  )
}
