import { useState } from 'react'
import { Navigate, useOutletContext } from 'react-router'
import { errorMessage } from '../../api/client'
import { useAccounts, useCreateAccount, useUpdateAccount } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice, Loading } from '../../components/ui/Notice'
import { shortDate } from '../../lib/dates'

const ROLE_LABEL = { admin: 'Administrador', user: 'Normal' }
const PASSWORD_HINT = 'Al menos 8 caracteres'

function NewAccountForm() {
  const create = useCreateAccount()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')

  function submit(event) {
    event.preventDefault()
    create.mutate(
      { email, password, role },
      {
        onSuccess: () => {
          setEmail('')
          setPassword('')
          setRole('user')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-panel bg-surface-2 p-5">
      <div className="label">Nueva cuenta</div>
      <Field
        label="Correo"
        type="email"
        autoComplete="off"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Field
        label="Contraseña"
        type="text"
        mono
        autoComplete="off"
        required
        minLength={8}
        hint={PASSWORD_HINT}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Tipo de cuenta</legend>
        <div className="flex gap-2">
          {(['user', 'admin']).map((option) => (
            <label
              key={option}
              className={`grid min-h-[38px] flex-1 cursor-pointer place-items-center rounded-control border px-3 text-center text-[13px] transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent max-sm:min-h-[44px] max-sm:text-[14px] ${role === option ? 'border-ink bg-ink text-white' : 'border-line-strong bg-control text-ink hover:border-ink/40'}`}
            >
              <input
                type="radio"
                name="role"
                value={option}
                checked={role === option}
                onChange={() => setRole(option)}
                className="sr-only"
              />
              {ROLE_LABEL[option]}
            </label>
          ))}
        </div>
      </fieldset>
      {create.error && <ErrorNotice>{errorMessage(create.error)}</ErrorNotice>}
      <Button type="submit" variant="primary" disabled={create.isPending}>
        {create.isPending ? 'Creando…' : 'Crear cuenta'}
      </Button>
      <p className="text-[12.5px] leading-normal text-ink-3">
        La cuenta arranca con un contrato de ejemplo, siete aparatos y cuatro consumos fijos.
      </p>
    </form>
  )
}

function PasswordModal({ account, onClose }) {
  const update = useUpdateAccount()
  const [password, setPassword] = useState('')

  function submit(event) {
    event.preventDefault()
    update.mutate({ id: account.id, password }, { onSuccess: onClose })
  }

  return (
    <Modal open onClose={onClose} title="Cambiar contraseña" aside={account.email}>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3.5">
        <Field
          label="Contraseña nueva"
          type="text"
          mono
          autoComplete="off"
          required
          minLength={8}
          hint={PASSWORD_HINT}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {update.error && <ErrorNotice>{errorMessage(update.error)}</ErrorNotice>}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" className="flex-1" disabled={update.isPending}>
            Guardar contraseña
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function AccountRow({ account, isSelf, onPassword }) {
  const update = useUpdateAccount()
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-line py-3.5">
      <div className="min-w-0 flex-1 basis-52">
        <div className={`truncate text-[14.5px] ${account.active ? 'text-ink' : 'text-ink-3 line-through'}`}>
          {account.email}
        </div>
        <div className="mt-1 font-mono text-[12px] text-ink-3">
          {ROLE_LABEL[account.role]} · alta {shortDate(account.createdAt.slice(0, 10))}
          {isSelf && ' · tu cuenta'}
        </div>
        {update.error && <div className="mt-1 text-[12.5px] text-danger-ink">{errorMessage(update.error)}</div>}
      </div>
      <span
        className={`rounded-[5px] px-2 py-[5px] font-mono text-[10.5px] leading-none font-medium tracking-[0.07em] uppercase ${account.active ? 'bg-valle text-ink-2' : 'bg-ink/8 text-ink-3'}`}
      >
        {account.active ? 'Activa' : 'Desactivada'}
      </span>
      <div className="flex gap-2">
        <Button size="sm" onClick={onPassword}>
          Cambiar contraseña
        </Button>
        {!isSelf && (
          <Button
            size="sm"
            variant={account.active ? 'danger' : 'soft'}
            disabled={update.isPending}
            onClick={() => update.mutate({ id: account.id, active: !account.active })}
          >
            {account.active ? 'Desactivar' : 'Activar'}
          </Button>
        )}
      </div>
    </li>
  )
}

export function AccountsPage() {
  const me = useOutletContext()
  // La lista sólo se pide si quien entra es administrador
  return me.role === 'admin' ? <AccountsAdmin me={me} /> : <Navigate to="/" replace />
}

function AccountsAdmin({ me }) {
  const accounts = useAccounts()
  const [editing, setEditing] = useState(null)

  return (
    <div className="flex max-w-[1080px] flex-col gap-6">
      <div>
        <h2 className="page-title">Cuentas</h2>
        <p className="page-lead mt-2">
          Cada cuenta tiene su casa, su contrato y sus facturas. Desde aquí se crean y se desactivan; los datos de cada
          una sólo los ve su dueño.
        </p>
      </div>

      <div className="grid items-start gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {accounts.error && (
            <ErrorNotice
              action={
                <Button size="sm" onClick={() => accounts.refetch()}>
                  Reintentar
                </Button>
              }
            >
              {errorMessage(accounts.error)}
            </ErrorNotice>
          )}
          {accounts.isPending && <Loading>Cargando cuentas…</Loading>}
          {accounts.data && (
            <ul className="border-b border-line">
              {accounts.data.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  isSelf={account.id === me.id}
                  onPassword={() => setEditing(account)}
                />
              ))}
            </ul>
          )}
        </div>
        <NewAccountForm />
      </div>

      {editing && <PasswordModal account={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
