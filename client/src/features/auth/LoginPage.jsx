import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '../../api/client'
import { useLogin, useMe } from '../../api/hooks'
import { Brand } from '../../components/layout/marks'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { ErrorNotice } from '../../components/ui/Notice'

export function LoginPage() {
  const me = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const destination = (location.state)?.from ?? '/'
  if (me.data) return <Navigate to={destination} replace />

  function submit(event) {
    event.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => navigate(destination, { replace: true }) })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center gap-7 px-5 py-10">
      <header>
        <Brand size="lg" />
        <div className="mt-3 font-mono text-[12px] text-ink-3">casa · peaje 2.0TD</div>
      </header>

      <form
        onSubmit={submit}
        className="flex animate-rise-in flex-col gap-4 rounded-modal border border-line bg-surface p-7 shadow-lifted max-sm:p-5"
      >
        <h1 className="text-[22px] leading-tight tracking-[-0.01em]">Entrar</h1>
        <Field
          label="Correo"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {login.error && <ErrorNotice>{errorMessage(login.error)}</ErrorNotice>}
        <Button type="submit" variant="primary" className="mt-1 min-h-[46px] text-[14.5px]" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="text-[12.5px] leading-normal text-ink-3">
        Las cuentas las crea el administrador. Si no tienes una, pídesela.
      </p>
    </main>
  )
}
