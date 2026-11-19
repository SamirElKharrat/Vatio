import { useNavigate } from 'react-router'
import { errorMessage } from '../../api/client'
import { usePauseRoutine, useSkipRoutine } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice, InfoNotice } from '../../components/ui/Notice'
import { usageCost, usageKwh } from '../../domain/cost'
import { approxEur, kwh } from '../../domain/format'
import { formatHM } from '../../domain/time'
import { deviceColor } from './colors'

/** Lo que se puede hacer con un bloque: editarlo o borrarlo, o gestionar la rutina de la que viene */
export function UsagePopover({ usage, device, routine, weekDays, contract, onEdit, onEditRoutineDays, onDelete, onClose }) {
  const skip = useSkipRoutine()
  const pause = usePauseRoutine()
  const navigate = useNavigate()

  const range = `${formatHM(usage.start)} – ${formatHM(usage.start + usage.hours)}`
  const detail = `${device.watts} W · ${kwh(usageKwh(device.watts, usage.hours))} · ${approxEur(usageCost(contract, device.watts, usage.date, usage.start, usage.hours))}`
  const error = skip.error ?? pause.error

  return (
    <Modal open onClose={onClose} title={device.name} aside={range} swatch={deviceColor(device.color)} width={410}>
      <div className="mt-2.5 font-mono text-[12.5px] text-ink-2">{detail}</div>

      {routine ? (
        <>
          <div className="mt-3.5">
            <InfoNotice>
              Viene de la rutina «{routine.name}». Puedes cambiar sus horas sólo este día o esta semana, saltarla
              este día, pausarla desde aquí o editar la rutina entera.
            </InfoNotice>
          </div>
          {error && (
            <div className="mt-3">
              <ErrorNotice>{errorMessage(error)}</ErrorNotice>
            </div>
          )}
          {/* Una sola acción principal; el resto baja de peso para que el diálogo se lea de un vistazo */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" className="flex-1" onClick={() => onEditRoutineDays([usage.date])}>
              Cambiar este día
            </Button>
            {weekDays.length > 1 && (
              <Button className="flex-1" onClick={() => onEditRoutineDays(weekDays)}>
                Cambiar esta semana
              </Button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="soft"
              className="flex-1"
              disabled={skip.isPending}
              onClick={() => skip.mutate({ id: routine.id, date: usage.date, skip: true }, { onSuccess: onClose })}
            >
              Saltar este día
            </Button>
            <Button
              className="flex-1"
              disabled={pause.isPending}
              onClick={() => pause.mutate({ id: routine.id, pausedFrom: usage.date }, { onSuccess: onClose })}
            >
              Pausar desde aquí
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
            <Button variant="quiet" className="-ml-2" onClick={() => navigate(`/fijos?rutina=${routine.id}`)}>
              Editar rutina
            </Button>
            <Button variant="quiet" className="-mr-2" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-5 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={onEdit}>
            Editar horas
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            Eliminar
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      )}
    </Modal>
  )
}
