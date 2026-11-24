import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { errorMessage } from '../../api/client'
import { useHousehold, usePauseRoutine, useSkipRoutine, useUpdateDevice } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ErrorNotice, InfoNotice, Loading } from '../../components/ui/Notice'
import { NumberInput } from '../../components/ui/NumberInput'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { daySummary } from '../../domain/aggregates'
import { loggableDevices } from '../../domain/devices'
import { usageCost, usageKwh, usageWatts } from '../../domain/cost'
import { approxEur, eur, kwh } from '../../domain/format'
import { routineStatus, routineWhen } from '../../domain/routines'
import { addDays, formatHM, startOfWeek } from '../../domain/time'
import { dayTitle, shortDate, todayISO } from '../../lib/dates'
import { DeviceEditor } from '../aparatos/DeviceEditor'
import { deviceColor } from '../consumo/colors'
import { FixedLoadEditor } from './FixedLoadEditor'
import { RoutineEditor } from './RoutineEditor'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Cómo se rotula cada estado de `routineStatus` en la tarjeta */
const STATUS = {
  active: { label: 'Activa hoy', className: 'bg-valle' },
  off: { label: 'Hoy no toca', className: 'bg-ink/6' },
  skipped: { label: 'Saltada hoy', className: 'bg-punta' },
  paused: { label: 'Pausada', className: 'bg-ink/8' },
}

/** Lo que está enchufado las 24 h: se suma solo a todos los días */
function FixedLoads({ home, today }) {
  // Los vatios de un fijo son los de su aparato: se cambian ahí
  const inline = useUpdateDevice()
  const [editing, setEditing] = useState(null)
  const [editingDeviceId, setEditingDeviceId] = useState(null)
  const editingDevice = home.devices.find((device) => device.id === editingDeviceId)

  const day = daySummary(home, today)
  const share = day.total.cost > 0 ? Math.round((day.fixed.cost / day.total.cost) * 100) : 0
  const wattsMax = Math.max(1, ...home.fixedLoads.map((load) => load.watts))

  return (
    <section>
      <SectionHeader
        title="Consumos fijos"
        action={<Button onClick={() => setEditing('new')}>+ Añadir consumo fijo</Button>}
      >
        Lo que está enchufado las 24 h y nunca apuntas: nevera, congelador, router, standby. Se suma solo todos los
        días.
      </SectionHeader>

      <div className="mt-5 flex gap-3">
        <div className="flex-1 rounded-panel bg-surface-2 px-[18px] py-4">
          <div className="label">Al día · estimado</div>
          <div className="mt-2.5 font-mono text-[22px] leading-none tracking-[-0.01em]">{eur(day.fixed.cost)}</div>
          <div className="mt-2 font-mono text-[12px] text-ink-3">{kwh(day.fixed.kwh)}</div>
        </div>
        <div className="flex-1 rounded-panel bg-surface-2 px-[18px] py-4">
          <div className="label">Del gasto de hoy</div>
          <div className="mt-2.5 font-mono text-[22px] leading-none tracking-[-0.01em]">{share} %</div>
          <div className="mt-2 font-mono text-[12px] text-ink-3">total estimado {eur(day.total.cost)}</div>
        </div>
      </div>

      {inline.error !== null && (
        <div className="mt-4">
          <ErrorNotice
            action={
              <Button size="sm" onClick={inline.clearError}>
                Cerrar
              </Button>
            }
          >
            No se ha guardado el último cambio. {errorMessage(inline.error)}
          </ErrorNotice>
        </div>
      )}

      {home.fixedLoads.length === 0 && (
        <p className="mt-5 border-y border-line py-4 text-[13.5px] text-ink-2">
          Aún no hay consumos fijos. Añade la nevera o el router para que el día no se quede corto.
        </p>
      )}

      {home.fixedLoads.map((load) => {
        const cost = usageCost(home.contract, load.watts, today, 0, 24)
        return (
          <div key={load.id} className="border-b border-line py-4">
            <div className="flex items-center gap-[11px]">
              <span className="size-[11px] flex-none rounded-swatch" style={{ background: deviceColor(load.color) }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] max-sm:text-[15px] max-sm:font-medium">{load.name}</div>
                {load.note && (
                  <div className="mt-1 truncate text-[12px] leading-snug text-ink-3 max-sm:whitespace-normal">{load.note}</div>
                )}
              </div>
              <NumberInput
                label={`Potencia de ${load.name}`}
                unit="W"
                width={70}
                min={1}
                max={100000}
                value={load.watts}
                onCommit={(watts) => inline.update(load.deviceId, { watts })}
              />
              <Button size="sm" onClick={() => setEditing(load)} aria-label={`Editar ${load.name}`}>
                Editar
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-swatch bg-ink/8">
                <div
                  className="h-full rounded-swatch"
                  style={{ width: `${(load.watts / wattsMax) * 100}%`, background: deviceColor(load.color) }}
                />
              </div>
              <span className="w-[80px] text-right font-mono text-[12px] text-ink-3">{kwh(usageKwh(load.watts, 24))}</span>
              <span className="w-[58px] text-right font-mono text-[12.5px] font-medium">{approxEur(cost)}</span>
              <span className="w-[96px] text-right font-mono text-[12px] text-ink-3">{approxEur(cost * 30)}/mes</span>
            </div>
          </div>
        )
      })}

      {editing && (
        <FixedLoadEditor
          key={editing === 'new' ? 'new' : editing.id}
          load={editing === 'new' ? null : editing}
          home={home}
          onEditDevice={(id) => {
            setEditing(null)
            setEditingDeviceId(id)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {editingDevice && (
        <DeviceEditor device={editingDevice} devices={home.devices} onClose={() => setEditingDeviceId(null)} />
      )}
    </section>
  )
}

function RoutineCard({ routine, home, today, onEdit }) {
  const skip = useSkipRoutine()
  const pause = usePauseRoutine()
  const device = home.devices.find((item) => item.id === routine.deviceId)
  if (!device) return null

  const status = routineStatus(routine, today)
  const paused = status === 'paused'
  const skipped = status === 'skipped'
  // Pausa puesta para un día que aún no ha llegado: hoy sigue en marcha y la pausa se puede quitar
  const pauseLater = routine.pausedFrom !== null && !paused
  const color = deviceColor(device.color)
  const error = skip.error ?? pause.error
  // Pausada o saltada se ve apagada, pero los botones siguen a la vista para reanudarla o editarla
  const faded = paused || skipped ? 'opacity-60' : ''

  return (
    <div data-state={status} className="mt-4 rounded-panel border border-line-strong bg-control p-[18px] shadow-raised max-sm:p-4">
      <div className={`flex items-start gap-[11px] ${faded}`}>
        <span className="mt-[5px] size-[11px] flex-none rounded-swatch" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">{routine.name}</div>
          <div className="mt-1.5 font-mono text-[12px] leading-relaxed text-ink-3">
            {routineWhen(routine.weekdays, formatHM(routine.start))} · {formatHM(routine.start)} –{' '}
            {formatHM(routine.start + routine.hours)} · {approxEur(usageCost(home.contract, usageWatts(device, routine), today, routine.start, routine.hours))}
            {pauseLater && ` · se pausa el ${shortDate(routine.pausedFrom)}`}
          </div>
          {routine.note && <div className="mt-2 border-l-2 border-line-strong pl-2.5 text-[12.5px] leading-snug text-ink-2">{routine.note}</div>}
        </div>
        <span className={`flex-none rounded-[5px] px-2 py-[5px] font-mono text-[10.5px] leading-none font-medium tracking-[0.07em] text-ink-2 uppercase ${STATUS[status].className}`}>
          {STATUS[status].label}
        </span>
      </div>

      {error && <div className="mt-2 text-[12.5px] text-danger-ink">{errorMessage(error)}</div>}

      <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-3 border-t border-line pt-3.5">
        <div className={`flex gap-1 ${faded}`} aria-label={`Días: ${routineWhen(routine.weekdays, formatHM(routine.start))}`}>
          {DAY_LETTERS.map((letter, day) => {
            const on = routine.weekdays.includes(day)
            return (
              <span
                key={day}
                aria-hidden
                className={`size-[26px] rounded-block text-center font-mono text-[11.5px] leading-[26px] font-medium ${on ? 'text-white' : 'bg-ink/6 text-ink-4'}`}
                style={on ? { background: color } : undefined}
              >
                {letter}
              </span>
            )
          })}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={skipped ? 'primary' : 'secondary'}
            // Sólo se salta un día en el que toca; un salto ya hecho siempre se puede deshacer
            disabled={!(status === 'active' || skipped) || skip.isPending}
            onClick={() => skip.mutate({ id: routine.id, date: today, skip: !skipped })}
          >
            {skipped ? 'Reactivar hoy' : 'Saltar hoy'}
          </Button>
          <Button
            size="sm"
            variant={paused ? 'primary' : 'secondary'}
            disabled={skipped || pause.isPending}
            onClick={() => pause.mutate({ id: routine.id, pausedFrom: routine.pausedFrom !== null ? null : today })}
          >
            {paused ? 'Reanudar' : pauseLater ? 'Quitar la pausa' : 'Pausar desde hoy'}
          </Button>
          <Button size="sm" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Costumbres y enchufes inteligentes: se apuntan solos los días que toca */
function Routines({ home, today }) {
  // La dirección puede traer la rutina que se quiere editar: /fijos?rutina=<id>
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const editing = home.routines.find((routine) => routine.id === params.get('rutina')) ?? null

  const edit = (id) => setParams(id ? { rutina: id } : {}, { replace: true })

  return (
    <section>
      <SectionHeader
        title="Rutinas"
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Nueva rutina
          </Button>
        }
      >
        Para enchufes inteligentes o costumbres fijas: se apuntan solas cada día. En la rejilla del día salen con borde
        punteado y ⟳.
      </SectionHeader>

      {home.routines.length === 0 && (
        <p className="mt-5 border-y border-line py-4 text-[13.5px] text-ink-2">
          Aún no hay rutinas. Crea una para lo que se enciende siempre a la misma hora.
        </p>
      )}
      {home.routines.map((routine) => (
        <RoutineCard key={routine.id} routine={routine} home={home} today={today} onEdit={() => edit(routine.id)} />
      ))}

      <div className="mt-5">
        <InfoNotice>
          «Saltar hoy» quita la rutina sólo de hoy, {dayTitle(today).toLowerCase()}. «Pausar desde hoy» la desactiva de
          hoy en adelante hasta que la reanudes.
        </InfoNotice>
      </div>

      {(creating || editing) && (
        <RoutineEditor
          key={editing?.id ?? 'new'}
          routine={editing}
          devices={loggableDevices(home)}
          allDevices={home.devices}
          onClose={() => {
            setCreating(false)
            edit(null)
          }}
        />
      )}
    </section>
  )
}

/** Pestaña Fijos y rutinas */
export function FijosPage() {
  const today = todayISO()
  const monday = startOfWeek(today)
  const { home, error, refetch } = useHousehold(monday, addDays(monday, 6))

  if (error) {
    return (
      <ErrorNotice
        action={
          <Button size="sm" onClick={refetch}>
            Reintentar
          </Button>
        }
      >
        {errorMessage(error)}
      </ErrorNotice>
    )
  }
  if (!home) return <Loading />

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 xl:grid-cols-2">
      <FixedLoads home={home} today={today} />
      <Routines home={home} today={today} />
    </div>
  )
}
