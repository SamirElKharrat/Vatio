import { NavLink } from 'react-router'

/** Selector de una opción entre varias, donde cada opción es una dirección */
export function SegmentedLinks({ label, options }) {
  return (
    <nav aria-label={label} className="flex gap-[3px] rounded-chip bg-ink/8 p-[3px]">
      {options.map((option) => (
        <NavLink
          key={option.to}
          to={option.to}
          className={({ isActive }) =>
            `grid min-h-[28px] place-items-center rounded-block px-3.5 text-[12.5px] leading-none max-sm:min-h-[36px] max-sm:px-4 max-sm:text-[13.5px] ${isActive ? 'bg-control font-medium text-ink shadow-raised' : 'text-ink-3 hover:text-ink'}`
          }
        >
          {option.label}
        </NavLink>
      ))}
    </nav>
  )
}
