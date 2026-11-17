const VARIANTS = {
  primary: 'border-transparent bg-accent font-medium text-white shadow-raised enabled:hover:bg-accent-hover',
  dark: 'border-transparent bg-ink text-white enabled:hover:bg-black',
  secondary: 'border-line-strong bg-control text-ink shadow-raised enabled:hover:border-ink/35 enabled:hover:bg-surface',
  soft: 'border-accent-line bg-accent-soft text-accent-ink enabled:hover:bg-accent/15',
  danger: 'border-accent-line bg-control text-accent-ink enabled:hover:bg-accent-soft',
  // Acción de retirada («Cerrar», «Cancelar»): sin caja, para que no compita con las demás
  quiet: 'border-transparent text-ink-2 enabled:hover:bg-hover enabled:hover:text-ink',
}

// En el móvil crecen hasta un tamaño cómodo para el dedo
const SIZES = {
  md: 'min-h-[42px] px-4 py-2.5 text-[13.5px] max-sm:min-h-[46px]',
  sm: 'min-h-[34px] px-3 py-1.5 text-[12.5px] max-sm:min-h-[40px] max-sm:px-3.5 max-sm:text-[13.5px]',
}

export function Button({ variant = 'secondary', size = 'md', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control border leading-none whitespace-nowrap select-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
