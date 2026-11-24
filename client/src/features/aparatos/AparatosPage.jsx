import { useState } from 'react'
import { errorMessage } from '../../api/client'
import { useHousehold, useUpdateDevice } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ErrorNotice, Loading } from '../../components/ui/Notice'
import { NumberInput } from '../../components/ui/NumberInput'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { periodSummary } from '../../domain/aggregates'
import { approxEur, kwh } from '../../domain/format'
import { addDays, datesBetween, startOfWeek } from '../../domain/time'
import { monthRange, todayISO } from '../../lib/dates'
import { useIsMobile } from '../../lib/useIsMobile'
import { deviceColor } from '../consumo/colors'
import { DeviceEditor } from './DeviceEditor'
import { DeviceTags } from './DeviceTags'
import { PowerCalculator } from './PowerCalculator'

const GRID =
  'grid grid-cols-[minmax(220px,1fr)_150px_64px_96px_86px_minmax(150px,230px)_72px] items-center gap-4 px-1'

/** «0,9 kWh/uso», para los aparatos en ese modo */
const perUseLabel = (device) => `${String(device.kwhPerUse).replace('.', ',')} kWh/uso`

/** Pestaña Aparatos: los vatios de cada aparato y lo que gasta cada uno esta semana y este mes */
export function AparatosPage() {
  const today = todayISO()
  const monday = startOfWeek(today)
  const sunday = addDays(monday, 6)
  const month = monthRange(today)
  const weekData = useHousehold(monday, sunday)
  const monthData = useHousehold(month.from, month.to)
  const inline = useUpdateDevice()
  const [editing, setEditing] = useState(null)
  const mobile = useIsMobile()

  const error = weekData.error ?? monthData.error
  if (error) {
    return (
      <ErrorNotice
        action={
          <Button size="sm" onClick={() => (weekData.refetch(), monthData.refetch())}>
            Reintentar
          </Button>
        }
      >
        {errorMessage(error)}
      </ErrorNotice>
    )
  }
  if (!weekData.home || !monthData.home) return <Loading />

  const { devices } = weekData.home
  const week = periodSummary(weekData.home, datesBetween(monday, sunday))
  const monthTotals = periodSummary(monthData.home, datesBetween(month.from, month.to))
  const costMax = Math.max(0.0001, ...devices.map((device) => week.byDevice[device.id]?.cost ?? 0))
  // Los aparatos que cuentan como consumo fijo: no se apuntan, se suman solos las 24 h
  const fixedIds = new Set(weekData.home.fixedLoads.map((load) => load.deviceId))
  const tags = (device) => (
    <DeviceTags
      isFixed={fixedIds.has(device.id)}
      routines={weekData.home.routines.filter((routine) => routine.deviceId === device.id)}
      today={today}
    />
  )
  // Un fijo no tiene usos: cuenta las 24 h de cada día del periodo
  const usesLabel = (totals) =>
    totals.fixed ? `24 h × ${totals.fixedDays}` : totals.uses === 1 ? '1 uso' : `${totals.uses} usos`

  return (
    <div className="max-w-[1120px]">
      <SectionHeader
        title="Aparatos"
        action={
          <Button variant="primary" className="max-sm:min-h-[52px] max-sm:text-[15px]" onClick={() => setEditing('new')}>
            + Añadir aparato
          </Button>
        }
      >
        Escribe los vatios exactos de cada aparato (los de la etiqueta) y todas las cuentas se recalculan al instante.
        Usos, kWh y coste son de esta semana; «Mes» es el mes en curso.
      </SectionHeader>

      <p className="mt-4 text-[12.5px] leading-normal text-ink-3">
        Todo se guarda en vatios (W). Si tu aparato lo dice en kW, kWh al año o voltios y amperios, elige la unidad al
        editarlo y se convierte sola.
      </p>
      <div className="mt-3">
        <PowerCalculator />
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

      {mobile && (
        <div className="mt-4">
          {devices.length === 0 && (
            <p className="border-b border-line py-4 text-[13.5px] text-ink-2">
              Aún no hay aparatos. Añade el primero para empezar a apuntar usos.
            </p>
          )}
          {devices.map((device) => {
            const totals = week.byDevice[device.id] ?? { kwh: 0, cost: 0, uses: 0 }
            return (
              <div key={device.id} className="border-b border-line py-4">
                <div className="flex items-center gap-3">
                  <span className="size-3 flex-none rounded-[4px]" style={{ background: deviceColor(device.color) }} />
                  <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium">{device.name}</span>
                  <NumberInput
                    label={`Potencia de ${device.name}`}
                    unit="W"
                    min={1}
                    max={100000}
                    width={70}
                    value={device.watts}
                    onCommit={(watts) => inline.update(device.id, { watts })}
                  />
                </div>
                {(fixedIds.has(device.id) || weekData.home.routines.some((routine) => routine.deviceId === device.id)) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-6">{tags(device)}</div>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-swatch bg-ink/8">
                    <div
                      className="h-full rounded-swatch"
                      style={{ width: `${(totals.cost / costMax) * 100}%`, background: deviceColor(device.color) }}
                    />
                  </div>
                  <span className={`font-mono text-[13px] ${totals.cost ? 'font-medium text-ink' : 'text-ink-4'}`}>
                    {approxEur(totals.cost)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <span className={`font-mono text-[12px] leading-relaxed ${totals.uses || totals.fixed ? 'text-ink-2' : 'text-ink-3'}`}>
                    {device.kwhPerUse && `${perUseLabel(device)} · `}
                    {usesLabel(totals)} · {kwh(totals.kwh)} · mes{' '}
                    {approxEur(monthTotals.byDevice[device.id]?.cost ?? 0)}
                  </span>
                  <Button size="sm" onClick={() => setEditing(device)} aria-label={`Editar ${device.name}`}>
                    Editar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!mobile && (
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className={`${GRID} label mt-7 border-b border-line-strong pb-2.5`}>
              <div>Aparato</div>
              <div className="text-center">Potencia</div>
              <div className="text-right">Usos</div>
              <div className="text-right">kWh</div>
              <div className="text-right">Mes (est.)</div>
              <div className="text-right">Coste semana (est.)</div>
              <div />
            </div>

            {devices.length === 0 && (
              <p className="border-b border-line px-1 py-5 text-[13.5px] text-ink-2">
                Aún no hay aparatos. Añade el primero para empezar a apuntar usos.
              </p>
            )}

            {devices.map((device) => {
              const totals = week.byDevice[device.id] ?? { kwh: 0, cost: 0, uses: 0 }
              const monthCost = monthTotals.byDevice[device.id]?.cost ?? 0
              // Las cifras a cero se apagan, para que destaquen los aparatos que sí han gastado
              const dim = (value) => (value ? '' : 'text-ink-4')
              return (
                <div key={device.id} className={`${GRID} border-b border-line py-3 hover:bg-hover`}>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-[11px] gap-y-1.5">
                    <span className="size-[11px] flex-none rounded-swatch" style={{ background: deviceColor(device.color) }} />
                    <span className="max-w-full truncate text-[14px]">{device.name}</span>
                    {tags(device)}
                  </div>
                  <div className="text-center">
                    <NumberInput
                      label={`Potencia de ${device.name}`}
                      unit="W"
                      min={1}
                      max={100000}
                      value={device.watts}
                      onCommit={(watts) => inline.update(device.id, { watts })}
                    />
                    {device.kwhPerUse && <div className="mt-1 font-mono text-[11px] text-ink-3">{perUseLabel(device)}</div>}
                  </div>
                  <div className={`text-right font-mono text-[12.5px] whitespace-nowrap ${dim(totals.uses || totals.fixed) || 'text-ink-2'}`}>
                    {totals.fixed ? `24 h × ${totals.fixedDays}` : totals.uses}
                  </div>
                  <div className={`text-right font-mono text-[12.5px] ${dim(totals.kwh)}`}>{kwh(totals.kwh)}</div>
                  <div className={`text-right font-mono text-[12.5px] ${dim(monthCost) || 'text-ink-2'}`}>{approxEur(monthCost)}</div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-swatch bg-ink/8">
                      <div
                        className="h-full rounded-swatch"
                        style={{ width: `${(totals.cost / costMax) * 100}%`, background: deviceColor(device.color) }}
                      />
                    </div>
                    <span className={`w-[60px] text-right font-mono text-[13px] ${dim(totals.cost) || 'font-medium'}`}>
                      {approxEur(totals.cost)}
                    </span>
                  </div>
                  <div className="text-right">
                    <Button size="sm" onClick={() => setEditing(device)} aria-label={`Editar ${device.name}`}>
                      Editar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && (
        <DeviceEditor
          device={editing === 'new' ? null : editing}
          devices={devices}
          deleteWarning={
            fixedIds.has(editing.id)
              ? 'Se borrarán también todos sus usos y rutinas, y dejará de contar como consumo fijo.'
              : 'Se borrarán también todos los usos apuntados de este aparato y sus rutinas.'
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
