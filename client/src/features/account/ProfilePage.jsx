import { useState } from 'react'
import { useOutletContext } from 'react-router'
import { errorMessage } from '../../api/client'
import { useChangePassword, useUpdateProfile } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { ErrorNotice } from '../../components/ui/Notice'
import { shortDate } from '../../lib/dates'

const ROLE_LABEL = { admin: 'Administrador', user: 'Normal' }

/** Aviso breve de que el cambio se ha guardado */
function Saved({ children }) {
  return (
    <p role="status" className="rounded-chip bg-valle px-3.5 py-3 text-[13px] leading-snug text-ink-2">
      {children}
    </p>
  )
}

function ProfileForm({ me }) {
  const update = useUpdateProfile()
  const [name, setName] = useState(me.name)
  const [email, setEmail] = useState(me.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [saved, setSaved] = useState(false)

  const emailChanged = email.trim().toLowerCase() !== me.email
  const changed = name.trim() !== me.name || emailChanged

  function submit(event) {
    event.preventDefault()
    setSaved(false)
    const changes = { name }
    if (emailChanged) Object.assign(changes, { email, currentPassword })
    update.mutate(changes, {
      onSuccess: ({ user }) => {
        setName(user.name)
        setEmail(user.email)
        setCurrentPassword('')
        setSaved(true)
      },
    })
  }

  const edit = (setter) => (event) => {
    setter(event.target.value)
    setSaved(false)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-panel bg-surface-2 p-5">
      <div className="label">Tus datos</div>
      <Field
        label="Nombre"
        autoComplete="name"
        maxLength={80}
        placeholder="Cómo quieres que te llame la app"
        value={name}
        onChange={edit(setName)}
      />
      <Field
        label="Correo"
        type="email"
        autoComplete="email"
        required
        hint="Es con el que entras en la app."
        value={email}
        onChange={edit(setEmail)}
      />
      {emailChanged && (
        <Field
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          required
          hint="Para cambiar el correo hace falta confirmar que eres tú."
          value={currentPassword}
          onChange={edit(setCurrentPassword)}
        />
      )}
      {update.error && <ErrorNotice>{errorMessage(update.error)}</ErrorNotice>}
      {saved && <Saved>Cambios guardados.</Saved>}
      <Button type="submit" variant="primary" disabled={!changed || update.isPending}>
        {update.isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [problem, setProblem] = useState('')
  const [saved, setSaved] = useState(false)

  function submit(event) {
    event.preventDefault()
    setSaved(false)
    if (newPassword.length < 8) return setProblem('La contraseña nueva debe tener al menos 8 caracteres')
    if (newPassword !== repeat) return setProblem('Las dos contraseñas nuevas no coinciden')
    setProblem('')
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setNewPassword('')
          setRepeat('')
          setSaved(true)
        },
      },
    )
  }

  const edit = (setter) => (event) => {
    setter(event.target.value)
    setSaved(false)
  }
  const message = problem || (change.error ? errorMessage(change.error) : '')

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-panel bg-surface-2 p-5">
      <div className="label">Contraseña</div>
      <Field
        label="Contraseña actual"
        type="password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={edit(setCurrentPassword)}
      />
      <Field
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Al menos 8 caracteres."
        value={newPassword}
        onChange={edit(setNewPassword)}
      />
      <Field
        label="Repite la contraseña nueva"
        type="password"
        autoComplete="new-password"
        required
        value={repeat}
        onChange={edit(setRepeat)}
      />
      {message && <ErrorNotice>{message}</ErrorNotice>}
      {saved && <Saved>Contraseña cambiada. Se han cerrado tus sesiones abiertas en otros dispositivos.</Saved>}
      <Button type="submit" variant="primary" disabled={change.isPending}>
        {change.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  )
}

/** El nombre de la casa: sale bajo el nombre de la app, junto a la comercializadora */
function HouseholdForm({ me }) {
  const update = useUpdateProfile()
  const [householdName, setHouseholdName] = useState(me.householdName)
  const [saved, setSaved] = useState(false)
  const changed = householdName.trim() !== me.householdName

  function submit(event) {
    event.preventDefault()
    setSaved(false)
    update.mutate(
      { householdName },
      {
        onSuccess: ({ user }) => {
          setHouseholdName(user.householdName)
          setSaved(true)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-panel bg-surface-2 p-5">
      <div className="label">Tu casa</div>
      <Field
        label="Nombre de la casa"
        maxLength={80}
        required
        placeholder="Casa, Piso centro, Apartamento playa…"
        hint="Sale arriba, bajo el nombre de la app, junto a la comercializadora."
        value={householdName}
        onChange={(event) => {
          setHouseholdName(event.target.value)
          setSaved(false)
        }}
      />
      {update.error && <ErrorNotice>{errorMessage(update.error)}</ErrorNotice>}
      {saved && <Saved>Nombre de la casa guardado.</Saved>}
      <Button type="submit" variant="primary" disabled={!changed || !householdName.trim() || update.isPending}>
        {update.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  )
}

/** La propia cuenta: nombre, casa, correo y contraseña */
export function ProfilePage() {
  const me = useOutletContext()
  return (
    <div className="flex max-w-[1080px] flex-col gap-6">
      <div>
        <h2 className="page-title">Mi cuenta</h2>
        <p className="page-lead mt-2">
          Cambia cómo te llamas en la app, el nombre de tu casa, el correo con el que entras y tu contraseña.
        </p>
        <p className="mt-2 font-mono text-[12px] text-ink-3">
          Cuenta {ROLE_LABEL[me.role]?.toLowerCase()} · alta {shortDate(me.createdAt.slice(0, 10))}
        </p>
      </div>
      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ProfileForm me={me} />
          <HouseholdForm me={me} />
        </div>
        <PasswordForm />
      </div>
    </div>
  )
}
