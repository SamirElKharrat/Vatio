import { NavLink } from 'react-router'
import { NavIcon } from './marks'
import { ADMIN_NAV, NAV } from './nav'

/** Pestañas del móvil, fijas al pie de la pantalla */
export function BottomNav({ account }) {
  const items = account.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 px-1.5 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `relative flex h-(--tabbar) flex-1 flex-col items-center justify-center gap-[5px] text-[11.5px] leading-none ${isActive ? 'font-medium text-accent-ink' : 'text-ink-3'}`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={`absolute top-0 h-[2.5px] w-7 rounded-b-[2px] ${isActive ? 'bg-accent' : 'bg-transparent'}`}
                aria-hidden="true"
              />
              <NavIcon name={item.icon} className={`size-[21px] ${isActive ? 'text-accent' : ''}`} />
              {item.short}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
