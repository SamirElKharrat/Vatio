import { NavLink, useNavigate } from 'react-router'
import { useHousehold, useInvoices, useLogout } from '../../api/hooks'
import { periodSummary } from '../../domain/aggregates'
import { eur } from '../../domain/format'
import { estimateInvoice, oneOffFees } from '../../domain/invoice'
import { datesBetween } from '../../domain/time'
import { monthRange, todayISO } from '../../lib/dates'
import { Brand, NavIcon } from './marks'
import { ADMIN_NAV, NAV } from './nav'

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group relative flex shrink-0 items-center gap-3 py-[11px] pr-4 pl-[22px] text-[13.5px] max-lg:px-4 ${isActive ? 'bg-white/10 font-medium text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute inset-y-[9px] left-0 w-[3px] rounded-r-[2px] max-lg:inset-x-4 max-lg:inset-y-auto max-lg:bottom-0 max-lg:h-[3px] max-lg:w-auto max-lg:rounded-t-[2px] max-lg:rounded-b-none ${isActive ? 'bg-accent' : 'bg-transparent'}`}
          />
          <NavIcon name={icon} className={`size-[17px] ${isActive ? 'text-white' : 'text-white/55 group-hover:text-white/80'}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

/** Diferencia entre la última factura y lo apuntado en su periodo, como en la pestaña Tarifa y factura */
function InvoiceGap({ invoice }) {
  const { home } = useHousehold(invoice.from, invoice.to)
  if (!home) return null
  const logged = periodSummary(home, datesBetween(invoice.from, invoice.to))
  const gap = invoice.total - estimateInvoice(home.contract, invoice.days, logged.byBand, oneOffFees(invoice)).total
  return (
    <div className="mt-2.5 border-t border-white/10 pt-2.5 text-[11.5px] leading-normal text-white/65">
      última factura: {gap < -0.005 ? 'te pasas' : 'sin explicar'} {eur(Math.abs(gap))}
    </div>
  )
}

/** Tarjeta con lo que lleva gastado el mes en curso, consumos fijos incluidos */
function MonthCard() {
  const { from, to } = monthRange(todayISO())
  const { home } = useHousehold(from, to)
  const invoices = useInvoices()
  const cost = home ? eur(periodSummary(home, datesBetween(from, todayISO())).total.cost) : '— €'
  return (
    <div className="rounded-panel bg-white/7 p-4 ring-1 ring-white/6 ring-inset">
      <div className="label text-white/60">Mes en curso</div>
      <div className="mt-2.5 font-mono text-[22px] leading-none tracking-[-0.01em] text-white">{cost}</div>
      <div className="mt-2 text-[11.5px] leading-normal text-white/65">apuntado hasta hoy, con los consumos fijos</div>
      {invoices.data?.[0] && <InvoiceGap invoice={invoices.data[0]} />}
    </div>
  )
}

export function Sidebar({ account }) {
  const logout = useLogout()
  const navigate = useNavigate()
  const items = account.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV

  const signOut = () => logout.mutate(undefined, { onSuccess: () => navigate('/login') })
  const signOutClass =
    'shrink-0 rounded-block border border-white/18 px-2.5 py-1.5 text-[12px] text-white/75 hover:border-white/35 hover:bg-white/6 hover:text-white'

  return (
    <aside className="on-ink flex flex-col bg-ink pt-6 pb-[22px] max-lg:pt-4 max-lg:pb-0 max-sm:hidden lg:sticky lg:top-0 lg:h-dvh">
      <div className="flex items-start justify-between px-[22px] pb-[26px] max-lg:pb-3">
        <div>
          <Brand tone="white" />
          <div className="mt-2 font-mono text-[11px] text-white/55">casa · peaje 2.0TD</div>
        </div>
        <button type="button" onClick={signOut} className={`${signOutClass} lg:hidden`}>
          Salir
        </button>
      </div>

      <nav aria-label="Secciones" className="flex flex-col max-lg:flex-row max-lg:overflow-x-auto">
        {items.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4 px-[22px] pt-6 max-lg:hidden">
        <MonthCard />
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[11px] text-white/60" title={account.email}>
            {account.email}
          </span>
          <button type="button" onClick={signOut} className={signOutClass}>
            Salir
          </button>
        </div>
      </div>
    </aside>
  )
}
