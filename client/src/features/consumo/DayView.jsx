import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '../../api/client'
import { useDeleteUsage, useUpdateUsage } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ErrorNotice } from '../../components/ui/Notice'
import { Stat, StatRow } from '../../components/ui/Stat'
import { daySummary } from '../../domain/aggregates'
import { loggableDevices } from '../../domain/devices'
import { usageCost, usageKwh } from '../../domain/cost'
import { approxEur, eur, kwh } from '../../domain/format'
import { bandAt, dayBands, isValleDay } from '../../domain/tariff'
import { usagesFor } from '../../domain/routines'
import { addDays, datesBetween, formatHM, startOfWeek, weekdayOf } from '../../domain/time'
import { hasOverlap } from '../../domain/usages'
import { dayTitle, todayISO } from '../../lib/dates'
import { useIsMobile } from '../../lib/useIsMobile'
import { BAND_BG, BAND_NAME, BAND_SOFT, deviceBorder, deviceColor, deviceColorSoft, deviceInk, deviceText } from './colors'
import { DayMobile } from './DayMobile'
import { TodayLink } from './TodayLink'
import { useBlockDrag } from './useBlockDrag'
import { UsageEditor } from './UsageEditor'
import { UsagePopover } from './UsagePopover'

// El diseño da 182 px a la columna del aparato, pero ahí «Aire acondicionado» se corta
const GRID = 'grid grid-cols-[240px_minmax(0,1fr)]'
const RULER = Array.from({ length: 12 }, (_, i) => String(i * 2).padStart(2, '0'))
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Hora actual en decimal, refrescada cada minuto, para la línea de «ahora» */
function useNow() {
  const read = () => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
  }
  const [now, setNow] = useState(read)
  useEffect(() => {
    const timer = setInterval(() => setNow(read()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function bandHoursText(contract, date) {
  if (contract.mode === 'fija') return 'Tarifa fija: el mismo precio a cualquier hora.'
  if (weekdayOf(date) >= 5) return 'Fin de semana: todo el día en valle.'
  if (isValleDay(date)) return 'Festivo nacional: todo el día en valle.'
  return 'Valle 00–08 · Punta 10–14 y 18–22 · Llano el resto.'
}

/** Tramos seguidos del mismo precio, para rotular la banda una vez por tramo y no hora a hora */
function bandRuns(bands) {
  const runs = []
  for (const [hour, band] of bands.entries()) {
    const last = runs.at(-1)
    if (last?.band === band) last.hours++
    else runs.push({ band, from: hour, hours: 1 })
  }
  return runs
}

function UsageBlock({ usage, device, contract, drag, clash, onPointerDown, onOpen }) {
  const auto = !!usage.routineId
  const dragging = drag?.id === usage.id
  const range = `${formatHM(usage.start)}–${formatHM(usage.start + usage.hours)}`
  const cost = approxEur(usageCost(contract, device.watts, usage.date, usage.start, usage.hours))
  const title = auto
    ? `${device.name} · rutina automática ${range} · ${cost}. Pulsa para gestionarla`
    : `${device.name} · ${range} · ${kwh(usageKwh(device.watts, usage.hours))} · ${cost}. Arrastra para mover, tira de los bordes para alargar, pulsa para editar`

  function onKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      onKeyDown={onKeyDown}
      onPointerDown={auto ? undefined : (event) => onPointerDown('move', event)}
      onClick={auto ? onOpen : undefined}
      className={`group @container absolute top-2 bottom-2 flex touch-pan-y items-center justify-center overflow-hidden rounded-block border hover:brightness-[1.06] ${auto ? 'cursor-pointer border-dashed' : dragging ? 'z-10 cursor-grabbing' : 'cursor-grab'} ${clash ? 'outline-2 outline-danger-ink' : ''}`}
      style={{
        left: `${(usage.start / 24) * 100}%`,
        width: `${(usage.hours / 24) * 100}%`,
        background: auto ? deviceColorSoft(device.color) : deviceColor(device.color),
        borderColor: deviceBorder(device.color),
        color: auto ? deviceInk(device.color) : deviceText(device.color),
        opacity: dragging ? 0.6 : 1,
        boxShadow: dragging
          ? '0 8px 18px -4px rgb(38 33 27 / .35)'
          : auto
            ? 'none'
            : 'inset 0 1px 0 rgb(255 255 255 / .22), 0 1px 2px rgb(38 33 27 / .16)',
      }}
    >
      {/* El texto se adapta al ancho real del bloque: la marca, la hora de inicio o el tramo entero */}
      <span className="pointer-events-none flex items-center gap-1 font-mono text-[11px] leading-none font-medium whitespace-nowrap">
        {auto && <span>⟳</span>}
        <span className="hidden @min-[52px]:inline">{formatHM(usage.start)}</span>
        <span className="hidden @min-[104px]:inline">–{formatHM(usage.start + usage.hours)}</span>
      </span>
      {!auto && (
        <>
          <div
            title="Cambiar la hora de inicio"
            onPointerDown={(event) => onPointerDown('start', event)}
            className="absolute inset-y-0 left-0 grid w-2 cursor-ew-resize touch-pan-y place-items-center"
          >
            <span className="h-3 w-[2px] rounded-[1px] bg-white/55 group-hover:bg-white/95" />
          </div>
          <div
            title="Cambiar la hora de fin"
            onPointerDown={(event) => onPointerDown('end', event)}
            className="absolute inset-y-0 right-0 grid w-2 cursor-ew-resize touch-pan-y place-items-center"
          >
            <span className="h-3 w-[2px] rounded-[1px] bg-white/55 group-hover:bg-white/95" />
          </div>
        </>
      )}
    </div>
  )
}

/** Consumo · Día: una fila por aparato sobre una pista de 24 horas; en el móvil, resumen y lista de usos */
export function DayView({ home, date }) {
  const update = useUpdateUsage()
  const remove = useDeleteUsage()
  const now = useNow()
  const mobile = useIsMobile()
  // Un solo diálogo a la vez: `null`, el de un bloque pulsado (`usage`) o el editor (`editor`, con su `target`)
  const [dialog, setDialog] = useState(null)
  const openUsage = (id) => setDialog({ kind: 'usage', id })
  const openEditor = (target) => setDialog({ kind: 'editor', target })
  const closeDialog = () => setDialog(null)
  const openId = dialog?.kind === 'usage' ? dialog.id : null

  const { drag, begin } = useBlockDrag({
    onTap: (usage) => openUsage(usage.id),
    onDrop: (usage, start, hours) => {
      // Si pisa otro uso del mismo aparato, el bloque vuelve a su sitio
      if (hasOverlap(daySummary(home, date).usages, usage.deviceId, start, hours, usage.id)) return
      update.update(usage.id, { start, hours })
    },
  })

  // Mientras se arrastra, las cuentas se hacen con la posición provisional del bloque
  const live = drag
    ? { ...home, usages: home.usages.map((u) => (u.id === drag.id ? { ...u, start: drag.start, hours: drag.hours } : u)) }
    : home
  const day = daySummary(live, date)
  const { contract } = home
  const isFija = contract.mode === 'fija'
  const bands = dayBands(date)
  const devices = new Map(home.devices.map((device) => [device.id, device]))
  // Los aparatos que son consumo fijo no se apuntan: sólo salen en la rejilla si ese día tienen algún uso
  const loggable = loggableDevices(home)
  const rows = home.devices.filter(
    (device) => loggable.includes(device) || day.usages.some((usage) => usage.deviceId === device.id),
  )

  const dragged = drag ? day.usages.find((usage) => usage.id === drag.id) : undefined
  const clash = !!dragged && hasOverlap(day.usages, dragged.deviceId, dragged.start, dragged.hours, dragged.id)

  const open = openId ? day.usages.find((usage) => usage.id === openId) : undefined
  const openDevice = open ? devices.get(open.deviceId) : undefined
  const openRoutine = open?.routineId ? (home.routines.find((routine) => routine.id === open.routineId) ?? null) : null
  // Días de esta semana en los que sale la rutina: los que cambia «Cambiar esta semana»
  const monday = startOfWeek(date)
  const routineWeek = openRoutine
    ? datesBetween(monday, addDays(monday, 6)).filter((day) =>
        usagesFor(day, home.usages, home.routines).some((usage) => usage.routineId === openRoutine.id),
      )
    : []
  const saveError = update.error ?? remove.error

  const diary = [...day.usages]
    .filter((usage) => devices.has(usage.deviceId))
    .sort((a, b) => a.start - b.start || a.deviceId.localeCompare(b.deviceId))

  const legend = isFija
    ? [{ name: 'Precio único', className: 'bg-flat', price: price(contract.fixedPrice, 4) }]
    : (['valle', 'llano', 'punta']).map((band) => ({
        name: BAND_NAME[band],
        className: BAND_BG[band],
        price: price(contract.prices[band], 3),
      }))

  const notice = saveError && (
    <ErrorNotice
      action={
        <Button
          size="sm"
          onClick={() => {
            update.reset()
            remove.reset()
          }}
        >
          Cerrar
        </Button>
      }
    >
      No se ha guardado el cambio y se ha deshecho. {errorMessage(saveError)}
    </ErrorNotice>
  )

  const dialogs = (
    <>
      {open && openDevice && (
        <UsagePopover
          usage={open}
          device={openDevice}
          routine={openRoutine}
          weekDays={routineWeek}
          contract={contract}
          onClose={closeDialog}
          onEditRoutineDays={(dates) => openEditor({ mode: 'routine', usage: open, routine: openRoutine, dates })}
          onDelete={() => remove.remove(open.id)}
          onEdit={() => openEditor({ mode: 'edit', usage: open })}
        />
      )}
      {dialog?.kind === 'editor' && (
        <UsageEditor
          target={dialog.target}
          date={date}
          devices={loggable}
          allDevices={home.devices}
          contract={contract}
          dayUsages={day.usages}
          onDelete={remove.remove}
          onClose={closeDialog}
        />
      )}
    </>
  )

  if (mobile) {
    return (
      <>
        <DayMobile
          home={home}
          date={date}
          day={day}
          notice={notice}
          onOpen={openUsage}
          onAdd={() => openEditor({ mode: 'new', deviceId: loggable[0]?.id ?? '' })}
        />
        {dialogs}
      </>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="page-title">{dayTitle(date)}</h2>
            <TodayLink span="dia" date={date} />
          </div>
          <p className="page-lead mt-2 max-w-[72ch] text-[12.5px]">
            Pulsa + junto al aparato para apuntar un uso · arrastra un bloque para moverlo · tira de los bordes para
            alargarlo · pulsa para editar o borrar
          </p>
        </div>
        <StatRow>
          <Stat label="Consumo" value={kwh(day.kwh)} />
          <Stat label="Coste estimado" value={eur(day.cost)} />
          <Stat label="Fijos (24 h) · est." value={eur(day.fixed.cost)} />
          {!isFija && <Stat accent label="Si fuera valle · est." value={'−' + eur(day.valleSaving)} />}
        </StatRow>
      </div>

      {notice && <div className="mb-4">{notice}</div>}

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className={`${GRID} items-center`}>
            <div className="label">{isFija ? 'Precio único' : 'Tramo horario'}</div>
            {isFija ? (
              <div title="El mismo precio a cualquier hora" className="h-1.5 rounded-[3px] bg-flat" />
            ) : (
              <div className="flex h-[18px] gap-px overflow-hidden rounded-[5px]">
                {bandRuns(bands).map((run) => (
                  <div
                    key={run.from}
                    title={`${BAND_NAME[run.band]} · ${String(run.from).padStart(2, '0')}–${String(run.from + run.hours).padStart(2, '0')} h`}
                    style={{ flexGrow: run.hours }}
                    className={`grid basis-0 place-items-center overflow-hidden font-mono text-[10px] leading-none font-medium tracking-[0.06em] text-ink-2 uppercase ${BAND_BG[run.band]}`}
                  >
                    {BAND_NAME[run.band]}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`${GRID} mt-1 mb-1.5`}>
            <div />
            <div className="flex">
              {RULER.map((hour) => (
                <div key={hour} className="flex-1 border-l border-line-strong pt-1 pb-0.5 pl-1.5 font-mono text-[11px] leading-none text-ink-3">
                  {hour}
                </div>
              ))}
            </div>
          </div>

          {rows.length === 0 && (
            <p className="border-t border-line py-6 text-[13.5px] text-ink-2">
              Aún no hay aparatos que apuntar. Añádelos en{' '}
              <Link to="/aparatos" className="font-medium text-ink underline underline-offset-2">
                Aparatos
              </Link>{' '}
              y aquí podrás apuntar cuándo los usas.
            </p>
          )}

          {rows.map((device) => (
            <div key={device.id} className={`${GRID} items-center border-t border-line hover:bg-hover`}>
              <div className="flex items-center gap-2.5 pr-3.5 pl-1">
                <span className="size-2.5 flex-none rounded-swatch" style={{ background: deviceColor(device.color) }} />
                <span className="flex-1 truncate text-[13.5px] leading-tight">{device.name}</span>
                <span className="font-mono text-[11px] text-ink-3">{device.watts} W</span>
                <button
                  type="button"
                  title={`Apuntar un uso de ${device.name}`}
                  aria-label={`Apuntar un uso de ${device.name}`}
                  onClick={() => openEditor({ mode: 'new', deviceId: device.id })}
                  className="grid size-7 flex-none place-items-center rounded-[8px] border border-accent-line bg-accent-soft font-mono text-[15px] leading-none text-accent-ink hover:border-accent hover:bg-accent hover:text-white"
                >
                  +
                </button>
              </div>
              <div data-track className="relative h-[52px] overflow-hidden select-none">
                {!isFija && (
                  <div className="pointer-events-none absolute inset-0 flex">
                    {HOURS.map((hour) => (
                      <div key={hour} className={`flex-1 ${BAND_SOFT[bands[hour]]}`} />
                    ))}
                  </div>
                )}
                <div className="hour-grid pointer-events-none absolute inset-0" />
                {date === todayISO() && (
                  <div
                    title="Ahora"
                    className="pointer-events-none absolute inset-y-0 z-10 w-[1.5px] -translate-x-1/2 bg-accent"
                    style={{ left: `${(now / 24) * 100}%` }}
                  />
                )}
                {day.usages
                  .filter((usage) => usage.deviceId === device.id)
                  .map((usage) => (
                    <UsageBlock
                      key={usage.id}
                      usage={usage}
                      device={device}
                      contract={contract}
                      drag={drag}
                      clash={clash && usage.id === drag?.id}
                      onPointerDown={(mode, event) => begin(usage, mode, event)}
                      onOpen={() => openUsage(usage.id)}
                    />
                  ))}
              </div>
            </div>
          ))}
          <div className="border-t border-line" />
        </div>
      </div>

      <div className="mt-9 flex flex-wrap gap-x-12 gap-y-8">
        <div className="min-w-0 flex-1 basis-[420px]">
          <div className="label mb-3">Usos del día</div>
          {diary.length === 0 && (
            <p className="border-t border-line py-3.5 text-[13px] text-ink-2">
              Nada apuntado este día. Pulsa + junto a un aparato para añadir el primer uso.
            </p>
          )}
          {diary.map((usage) => {
            const device = devices.get(usage.deviceId)
            const band = bandAt(date, Math.floor(usage.start))
            return (
              <div key={usage.id} className="flex items-center gap-3 border-t border-line px-1 py-2.5 last:border-b hover:bg-hover">
                <span className="size-2.5 flex-none rounded-swatch" style={{ background: deviceColor(device.color) }} />
                <span className="w-[176px] flex-none truncate text-[13.5px]">{device.name}</span>
                <span className="w-[112px] flex-none font-mono text-[12px] text-ink-2">
                  {formatHM(usage.start)}–{formatHM(usage.start + usage.hours)}
                  {usage.routineId && (
                    <span title="Apuntado por una rutina" className="ml-1.5 text-ink-3">
                      ⟳
                    </span>
                  )}
                </span>
                <span className="w-[64px] flex-none text-right font-mono text-[12px] text-ink-3">{device.watts} W</span>
                <span className="min-w-0 flex-1 truncate text-right font-mono text-[12px] text-ink-2">
                  {kwh(usageKwh(device.watts, usage.hours))}
                </span>
                {/* Con precio fijo el tramo no cambia nada: la etiqueta sólo sale con la tarifa por tramos */}
                {!isFija && (
                  <span
                    className={`w-[52px] flex-none rounded-[4px] py-1 text-center font-mono text-[10px] leading-none font-medium tracking-[0.06em] text-ink-2 uppercase ${BAND_BG[band]}`}
                  >
                    {BAND_NAME[band]}
                  </span>
                )}
                <span className="w-[68px] flex-none text-right font-mono text-[13px] font-medium text-ink">
                  {approxEur(usageCost(contract, device.watts, date, usage.start, usage.hours))}
                </span>
              </div>
            )
          })}
        </div>

        <div className="w-[270px] flex-none">
          <div className="label mb-3">Precio por tramo</div>
          {legend.map((item) => (
            <div key={item.name} className="flex items-center gap-2.5 border-t border-line py-2.5 last:border-b">
              <span className={`size-3.5 flex-none rounded-[4px] ring-1 ring-ink/10 ring-inset ${item.className}`} />
              <span className="flex-1 text-[13px]">{item.name}</span>
              <span className="font-mono text-[12px] text-ink-2">{item.price}</span>
            </div>
          ))}
          <p className="mt-3 text-[12px] leading-normal text-ink-3">{bandHoursText(contract, date)}</p>
        </div>
      </div>

      {dialogs}
    </div>
  )
}

const price = (value, decimals) => value.toFixed(decimals).replace('.', ',') + ' €/kWh'
