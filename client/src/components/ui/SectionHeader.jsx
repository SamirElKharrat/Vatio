/**
 * Título de una página o sección con su texto de introducción y, a la derecha, la acción principal
 * (por ejemplo «+ Añadir aparato»), para que se vea sin bajar hasta el final de la lista.
 * En el móvil la acción baja debajo del texto y ocupa todo el ancho.
 */
export function SectionHeader({ title, children, action }) {
  return (
    <div className="flex items-start justify-between gap-x-6 gap-y-4 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0">
        <h2 className="page-title">{title}</h2>
        {children && <p className="page-lead mt-2">{children}</p>}
      </div>
      {action && <div className="flex flex-none flex-col sm:pt-1">{action}</div>}
    </div>
  )
}
