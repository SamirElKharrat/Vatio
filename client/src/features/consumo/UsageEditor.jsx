import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { useCreateUsage, useOverrideRoutine, useUpdateUsage } from '../../api/hooks'
import { DevicePicker } from '../../components/pickers'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/ui/Notice'
import { usageCost, usageKwh } from '../../domain/cost'
import { eur, kwh } from '../../domain/format'
import { bandAt, dayBands } from '../../domain/tariff'
import { formatHM, parseRange, QUARTER } from '../../domain/time'
import { firstFreeSlot, hasOverlap } from '../../domain/usages'
import { dayTitle } from '../../lib/dates'
import { useIsMobile } from '../../lib/useIsMobile'
import { BAND_BG, BAND_NAME, deviceColor } from './colors'

const RANGE_ERRORS = {
  formato: 'Escribe las horas como 19:30',
  orden: 'La hora de fin debe ser posterior a la de inicio',
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const STEP_CLASS =
  'grid size-10 flex-none place-items-center rounded-control border border-line-strong bg-surface font-mono text-[17px] leading-none text-ink enabled:hover:border-ink/35 enabled:active:bg-surface-2 disabled:opacity-35'

/** «1 h 30 min» */
function durationLabel(hours) {
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  return [whole ? `${whole} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean).join(' ')
}

/** Lo que gasta y cuesta el uso con las horas elegidas */
function Preview({ contract, device, date, start, hours }) {
  const tile = 'flex-1 rounded-[13px] bg-surface-2 px-[15px] py-3'
  return (
    <div className="mt-4 flex gap-2.5">
      <div className={tile}>
        <div className="label">Consumo</div>
        <div className="mt-2 font-mono text-[17px] leading-none">{kwh(usageKwh(device.watts, hours))}</div>
      </div>
      <div className={tile}>
        <div className="label">Coste{contract.mode !== 'fija' && ` · ${BAND_NAME[bandAt(date, Math.floor(start))]}`}</div>
        <div className="mt-2 font-mono text-[17px] leading-none">{eur(usageCost(contract, device.watts, date, start, hours))}</div>
      </div>
    </div>
  )
}

/** Fila con una cifra y sus botones de menos y más, de cuarto en cuarto de hora */
function Stepper({ label, value, onLess, onMore }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="text-[13.5px]">{label}</span>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={`${label}: 15 minutos menos`}
          disabled={!onLess}
          onClick={onLess ?? undefined}
          className={STEP_CLASS}
        >
          −
        </button>
        <span aria-live="polite" className="min-w-[84px] text-center font-mono text-[15px]">
          {value}
        </span>
        <button
          type="button"
          aria-label={`${label}: 15 minutos más`}
          disabled={!onMore}
          onClick={onMore ?? undefined}
          className={STEP_CLASS}
        >
          +
        </button>
      </div>
    </div>
  )
}

/**
 * Diálogo para apuntar un uso nuevo, cambiar las horas de uno apuntado o cambiar una rutina
 * sólo en unos días (`mode: 'routine'`, con la rutina y las fechas).
 */
export function UsageEditor({ target, date, devices, contract, dayUsages, onDelete, onClose }) {
  const mobile = useIsMobile()
  const create = useCreateUsage()
  const update = useUpdateUsage()
  const override = useOverrideRoutine()

  const editing = target.mode === 'edit' ? target.usage : null
  const routine = target.mode === 'routine' ? target.routine : null
  const [deviceId, setDeviceId] = useState(target.mode === 'new' ? target.deviceId : target.usage.deviceId)
  const [from, setFrom] = useState(() => formatHM(initialRange(target, devices, dayUsages).start))
  const [to, setTo] = useState(() => {
    const range = initialRange(target, devices, dayUsages)
    return formatHM(range.start + range.hours)
  })
  const [problem, setProblem] = useState('')

  const serverError = create.error ?? update.error ?? override.error
  const message = problem || (serverError ? errorMessage(serverError) : '')

  function pickDevice(id) {
    setDeviceId(id)
    setProblem('')
  }

  function submit(event) {
    event.preventDefault()
    const range = parseRange(from, to)
    if ('error' in range) return setProblem(RANGE_ERRORS[range.error])
    if (hasOverlap(dayUsages, deviceId, range.start, range.hours, target.usage?.id)) {
      return setProblem('Ya hay un uso de este aparato en esa franja')
    }
    setProblem('')
    if (routine) override.mutate({ id: routine.id, dates: target.dates, ...range }, { onSuccess: onClose })
    else if (editing) update.update(editing.id, { deviceId, ...range }, { onSuccess: onClose })
    else create.mutate({ deviceId, date, ...range }, { onSuccess: onClose })
  }

  const week = target.dates?.length > 1
  const title = routine ? (week ? 'Cambiar la rutina esta semana' : 'Cambiar la rutina este día') : editing ? 'Editar uso' : 'Apuntar un uso'
  const aside = week ? `${target.dates.length} días` : dayTitle(date)
  const actions = (
    <>
      {routine && (
        <p className="mt-4 text-[12.5px] leading-normal text-ink-3">
          {week ? `Se aplica al ${target.dates.map((day) => dayTitle(day).toLowerCase()).join(', ')}.` : `Sólo para el ${dayTitle(date).toLowerCase()}.`}{' '}
          «{routine.name}» se salta {week ? 'esos días' : 'ese día'} y queda apuntado como un uso normal; el resto de días
          sigue igual.
        </p>
      )}
      {message && (
        <div className="mt-3">
          <ErrorNotice>{message}</ErrorNotice>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button
          type="submit"
          variant="primary"
          className="flex-1 max-sm:py-4 max-sm:text-[15px]"
          disabled={create.isPending || update.isPending || override.isPending}
        >
          Guardar
        </Button>
        {editing && (
          <Button
            variant="danger"
            onClick={() => {
              onDelete(editing.id)
              onClose()
            }}
          >
            Eliminar
          </Button>
        )}
        <Button variant="quiet" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </>
  )

  if (mobile) {
    // En el móvil las horas se eligen tocando, así que el rango siempre es válido
    const range = parseRange(from, to)
    const start = 'error' in range ? 0 : range.start
    const hours = 'error' in range ? 1 : range.hours
    const device = devices.find((item) => item.id === deviceId)
    const bands = dayBands(date)
    const isFija = contract.mode === 'fija'

    const setRange = (nextStart, nextHours) => {
      setFrom(formatHM(nextStart))
      setTo(formatHM(nextStart + nextHours))
      setProblem('')
    }

    return (
      <Modal open onClose={onClose} title={title} aside={aside}>
        <form onSubmit={submit}>
          {!routine && (
            <>
              <div className="label mt-5 mb-2.5">Aparato</div>
              <DevicePicker
                devices={devices}
                value={deviceId}
                onChange={(id) => {
                  pickDevice(id)
                  // Aquí el aparato se elige dentro de la hoja: un uso nuevo toma su duración habitual
                  const usual = devices.find((item) => item.id === id)?.defaultHours
                  if (!editing && usual) setRange(start, Math.min(usual, 24 - start))
                }}
              />
            </>
          )}

          <div className="mt-5 mb-2.5 flex items-baseline justify-between">
            <span className="label">Hora de encendido</span>
            <span className="font-mono text-[12.5px] font-medium text-ink">
              {formatHM(start)} – {formatHM(start + hours)}
            </span>
          </div>
          <div className="grid grid-cols-8 gap-1" role="group" aria-label="Hora de encendido">
            {HOURS.map((hour) => {
              const selected = hour >= Math.floor(start) && hour < start + hours
              const idle = isFija ? 'bg-ink/7' : BAND_BG[bands[hour]]
              return (
                <button
                  key={hour}
                  type="button"
                  aria-label={`Empezar a las ${hour}:00`}
                  aria-pressed={selected}
                  onClick={() => setRange(hour, Math.min(hours, 24 - hour))}
                  className={`h-10 rounded-block font-mono text-[12.5px] font-medium ${selected ? 'bg-ink text-white' : `text-ink-2 ${idle}`}`}
                  style={selected && device ? { background: deviceColor(device.hue) } : undefined}
                >
                  {String(hour).padStart(2, '0')}
                </button>
              )
            })}
          </div>

          <div className="mt-[18px] divide-y divide-line rounded-[13px] border border-line-strong bg-control">
            <Stepper
              label="Empieza"
              value={formatHM(start)}
              onLess={start > 0 ? () => setRange(start - QUARTER, hours) : null}
              onMore={start + hours < 24 ? () => setRange(start + QUARTER, hours) : null}
            />
            <Stepper
              label="Duración"
              value={durationLabel(hours)}
              onLess={hours > QUARTER ? () => setRange(start, hours - QUARTER) : null}
              onMore={start + hours < 24 ? () => setRange(start, hours + QUARTER) : null}
            />
          </div>

          {device && <Preview contract={contract} device={device} date={date} start={start} hours={hours} />}

          {actions}
        </form>
      </Modal>
    )
  }

  // En el escritorio las horas se escriben: las cuentas salen en cuanto el rango es válido
  const typed = parseRange(from, to)
  const typedDevice = devices.find((item) => item.id === deviceId)

  return (
    <Modal open onClose={onClose} title={title} aside={aside}>
      <form onSubmit={submit}>
        {!routine && (
          <>
            <div className="label mt-5 mb-2.5">Aparato</div>
            <DevicePicker devices={devices} value={deviceId} onChange={pickDevice} />
          </>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field
            mono
            label="Empieza a las"
            placeholder="19:00"
            inputMode="numeric"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Field
            mono
            label="Termina a las"
            placeholder="21:00"
            inputMode="numeric"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <p className="mt-2 text-[12px] leading-normal text-ink-3">
          Escribe la hora como 19:30 · se redondea a cuartos de hora
        </p>
        {typedDevice && !('error' in typed) && (
          <Preview contract={contract} device={typedDevice} date={date} start={typed.start} hours={typed.hours} />
        )}

        {actions}
      </form>
    </Modal>
  )
}

/** Horas con las que se abre el diálogo: las del uso, o el primer hueco libre del aparato */
function initialRange(target, devices, dayUsages) {
  if (target.mode !== 'new') return { start: target.usage.start, hours: target.usage.hours }
  const hours = devices.find((device) => device.id === target.deviceId)?.defaultHours ?? 1
  return { start: firstFreeSlot(dayUsages, target.deviceId, hours), hours }
}
