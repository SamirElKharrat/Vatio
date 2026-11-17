const ICONS = {
  consumo: <path d="M4 16.5V10M10 16.5v-13M16 16.5V7.5" />,
  aparatos: <path d="M7.25 2.75v4M12.75 2.75v4M5 6.75h10v3.5a5 5 0 0 1-10 0v-3.5ZM10 15.25v2.25" />,
  fijos: <path d="M3.75 9.25a6.25 6.25 0 0 1 11-3.5l1.5 1.5M16.25 3.5v3.75H12.5M16.25 10.75a6.25 6.25 0 0 1-11 3.5l-1.5-1.5M3.75 16.5v-3.75H7.5" />,
  tarifa: <path d="M5.25 2.75h9.5v14.5l-2.4-1.5-2.35 1.5-2.35-1.5-2.4 1.5V2.75ZM8 7h4M8 10.25h4" />,
  cuentas: <path d="M10 9.75a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5ZM4 17a6 6 0 0 1 12 0" />,
}

/** Icono de una sección, a trazo, del color del texto que lo acompaña */
export function NavIcon({ name, className = 'size-[18px]' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className}`}
    >
      {ICONS[name]}
    </svg>
  )
}

/** Flecha de paso: anterior o siguiente */
export function Chevron({ direction = 'right', className = 'size-3.5' }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={direction === 'left' ? 'M8.75 2.75 4.5 7l4.25 4.25' : 'M5.25 2.75 9.5 7l-4.25 4.25'} />
    </svg>
  )
}

/** Marca de la app: el rayo sobre el naranja de acento y el nombre */
export function Brand({ tone = 'ink', size = 'md' }) {
  const big = size === 'lg'
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={`grid flex-none place-items-center bg-accent ${big ? 'size-9 rounded-[10px]' : 'size-[26px] rounded-[7px]'}`}>
        <svg viewBox="0 0 20 20" fill="white" aria-hidden="true" className={big ? 'size-5' : 'size-[15px]'}>
          <path d="M11.6 1.75 4.5 11.1h4.3l-1 7.15 7.7-9.9h-4.6l.7-6.6Z" />
        </svg>
      </span>
      <span
        className={`font-medium tracking-[-0.01em] ${big ? 'text-[22px]' : 'text-[16px]'} ${tone === 'white' ? 'text-white' : 'text-ink'}`}
      >
        Vatios
      </span>
    </span>
  )
}
