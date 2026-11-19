import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLogout, useMe } from '../../api/hooks'
import { PROFILE_NAV } from './nav'

const ITEM = 'block w-full px-3.5 py-2.5 text-left text-[13.5px] text-ink hover:bg-hover focus-visible:bg-hover'

/** La cuenta, arriba a la derecha: la inicial y el nombre, con «Mi cuenta» y «Salir» al pulsar */
export function AccountMenu() {
  const me = useMe().data
  const logout = useLogout()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  // Se cierra al pulsar fuera o con Escape
  useEffect(() => {
    if (!open) return
    const onPointer = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!me) return null
  const shown = me.name || me.email
  const initial = shown.trim().charAt(0).toUpperCase()

  return (
    <div ref={box} className="relative ml-2 max-sm:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center gap-2 rounded-chip border border-line-strong bg-control py-1 pr-3 pl-1 text-[13px] text-ink shadow-raised hover:border-ink/35"
      >
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-[7px] bg-ink text-[13px] font-medium text-white">
          {initial}
        </span>
        <span className="max-w-[140px] truncate max-lg:hidden">{me.name || PROFILE_NAV.label}</span>
        <span aria-hidden="true" className="text-[10px] text-ink-3">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Tu cuenta"
          className="absolute top-full right-0 z-30 mt-1.5 w-[230px] overflow-hidden rounded-control border border-line-strong bg-surface py-1 shadow-raised"
        >
          <div className="border-b border-line px-3.5 pt-2 pb-2.5">
            <div className="truncate text-[13.5px] font-medium">{shown}</div>
            {me.name && <div className="truncate font-mono text-[11px] text-ink-3">{me.email}</div>}
            <div className="mt-0.5 truncate font-mono text-[11px] text-ink-3">{me.householdName}</div>
          </div>
          <Link role="menuitem" to={PROFILE_NAV.to} onClick={() => setOpen(false)} className={ITEM}>
            Mi cuenta
            <span className="block text-[12px] text-ink-3">Nombre, casa, correo y contraseña</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}
            className={ITEM}
          >
            Salir
          </button>
        </div>
      )}
    </div>
  )
}
