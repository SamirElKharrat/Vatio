import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useHousehold, useLogout } from '../../api/hooks'
import { periodSummary } from '../../domain/aggregates'
import { approxEur, kwh } from '../../domain/format'
import { addDays, datesBetween, startOfWeek } from '../../domain/time'
import { dayTitle, shiftMonth, todayISO, weekNumber } from '../../lib/dates'
import { useIsMobile } from '../../lib/useIsMobile'
import { consumoPath, useSelectedDate } from '../../lib/useSelectedDate'
import { ExportDialog } from '../../features/consumo/ExportDialog'
import { Button } from '../ui/Button'
import { SegmentedLinks } from '../ui/Segmented'
import { AccountMenu } from './AccountMenu'
import { HouseholdLine } from './HouseholdLine'
import { Brand, Chevron, NavIcon } from './marks'
import { ADMIN_NAV, NAV, PROFILE_NAV } from './nav'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const STEP_CLASS =
  'grid h-10 w-[30px] place-items-center rounded-chip border border-line-strong bg-control text-ink-2 shadow-raised hover:border-ink/35 hover:text-ink max-sm:w-10'

function tariffChip(contract) {
  return contract.mode === 'fija'
    ? 'Tarifa fija · ' + contract.fixedPrice.toFixed(4).replace('.', ',') + ' €/kWh'
    : 'Tarifa por tramos 2.0TD'
}

export function TopBar() {
  const { pathname } = useLocation()
  const { date, span } = useSelectedDate()
  const mobile = useIsMobile()
  const [exporting, setExporting] = useState(false)
  const logout = useLogout()
  const navigate = useNavigate()
  const today = todayISO()
  const monday = startOfWeek(date)
  const week = datesBetween(monday, addDays(monday, 6))
  const { home } = useHousehold(week[0], week[6])

  const title = [...NAV, ADMIN_NAV, PROFILE_NAV].find((item) => pathname.startsWith(item.to))?.label
  const isConsumo = pathname.startsWith('/consumo')
  const totals = home ? periodSummary(home, week) : null

  // Las flechas saltan de semana en semana, o de mes en mes en la vista Mes.
  // En el móvil no están las letras de los días, así que en la vista Día saltan de día en día.
  const byDay = mobile && span === 'dia'
  const step = (direction) =>
    span === 'mes' ? shiftMonth(date, direction) : addDays(date, (byDay ? 1 : 7) * direction)
  const stepName = span === 'mes' ? 'Mes' : byDay ? 'Día' : 'Semana'
  // Fuera de Consumo, en el móvil la barra sólo lleva el nombre de la app y «Salir»
  const mobileOnlyConsumo = isConsumo ? '' : 'max-sm:hidden'

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-line bg-surface-2 px-8 py-3.5 max-lg:px-6 max-sm:px-4 max-sm:py-3">
      <div className="flex w-full items-center justify-between gap-3 sm:hidden">
        <div className="min-w-0">
          <Brand />
          <HouseholdLine className="mt-1 text-ink-3" />
        </div>
        <div className="flex flex-none gap-2">
          <Link
            to={PROFILE_NAV.to}
            title={PROFILE_NAV.label}
            className="flex h-9 items-center gap-1.5 rounded-block border border-line-strong px-2.5 text-[12.5px] text-ink-2 hover:bg-control"
          >
            <NavIcon name={PROFILE_NAV.icon} className="size-[17px]" />
            Cuenta
          </Link>
          <button
            type="button"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
            className="grid min-h-9 place-items-center rounded-block border border-line-strong px-3 text-[12.5px] text-ink-2 hover:bg-control"
          >
            Salir
          </button>
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-2 ${mobileOnlyConsumo}`}>
        <h1 className="text-[17px] font-medium tracking-[-0.01em] text-ink max-sm:sr-only">{title}</h1>
        <span className="font-mono text-[11.5px] text-ink-3 max-sm:hidden">
          semana {weekNumber(date)}
          {totals && ` · ${kwh(totals.kwh)} · ${approxEur(totals.cost)} estimado`}
        </span>
        {home && (
          <span className="rounded-[6px] bg-accent/10 px-2.5 py-[5px] font-mono text-[11px] leading-none text-accent-ink max-sm:hidden">
            {tariffChip(home.contract)}
          </span>
        )}
        {isConsumo && (
          <SegmentedLinks
            label="Vista de consumo"
            options={[
              { to: consumoPath('dia', date), label: 'Día' },
              { to: consumoPath('semana', date), label: 'Semana' },
              { to: consumoPath('mes', date), label: 'Mes' },
            ]}
          />
        )}
        {isConsumo && (
          // En el móvil no cabe aquí: va al pie de Consumo
          <Button size="sm" className="max-sm:hidden" onClick={() => setExporting(true)}>
            Descargar CSV
          </Button>
        )}
        {exporting && <ExportDialog onClose={() => setExporting(false)} />}
      </div>

      <div className={`flex flex-wrap items-center gap-1.5 ${mobileOnlyConsumo}`}>
        {isConsumo && (
          <Link to={consumoPath(span, step(-1))} title={`${stepName} anterior`} aria-label={`${stepName} anterior`} className={STEP_CLASS}>
            <Chevron direction="left" />
          </Link>
        )}
        <nav aria-label="Días de la semana" className="flex gap-1.5 max-sm:hidden">
          {week.map((day, i) => {
            const selected = isConsumo && span === 'dia' && day === date
            const isToday = day === today
            return (
              <Link
                key={day}
                to={consumoPath('dia', day)}
                title={dayTitle(day)}
                aria-label={dayTitle(day)}
                aria-current={selected ? 'date' : undefined}
                className={`flex h-10 w-[38px] flex-col items-center justify-center gap-[5px] rounded-chip border leading-none ${selected ? 'border-ink bg-ink text-white' : isToday ? 'border-accent-line bg-control text-accent-ink shadow-raised hover:border-accent' : 'border-line-strong bg-control text-ink shadow-raised hover:border-ink/35'}`}
              >
                <span className={`font-mono text-[9.5px] font-medium ${selected ? 'text-white/70' : isToday ? 'text-accent-ink/80' : 'text-ink-3'}`}>{DAY_LETTERS[i]}</span>
                <span className="font-mono text-[13px] font-medium">{Number(day.slice(8))}</span>
              </Link>
            )
          })}
        </nav>
        {isConsumo && (
          <Link to={consumoPath(span, step(1))} title={`${stepName} siguiente`} aria-label={`${stepName} siguiente`} className={STEP_CLASS}>
            <Chevron />
          </Link>
        )}
        <AccountMenu />
      </div>
    </header>
  )
}
