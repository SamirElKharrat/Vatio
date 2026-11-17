import { Navigate, Outlet, useLocation } from 'react-router'
import { errorMessage } from '../../api/client'
import { useMe } from '../../api/hooks'
import { Button } from '../ui/Button'
import { ErrorNotice, Loading } from '../ui/Notice'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/** Marco de la app: barra lateral (o pestañas al pie en el móvil), barra superior y la pestaña abierta. Exige sesión. */
export function AppShell() {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface">
        <Loading />
      </div>
    )
  }

  if (me.error) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-[420px] place-content-center px-5">
        <ErrorNotice
          action={
            <Button size="sm" onClick={() => me.refetch()}>
              Reintentar
            </Button>
          }
        >
          {errorMessage(me.error)}
        </ErrorNotice>
      </div>
    )
  }

  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-surface lg:grid-cols-[212px_minmax(0,1fr)] max-lg:grid-rows-[auto_minmax(0,1fr)]">
      <Sidebar account={me.data} />
      <div className="flex min-w-0 flex-col">
        <TopBar />
        <main className="flex-1 px-8 pt-7 pb-12 max-lg:px-6 max-sm:px-4 max-sm:pt-5 max-sm:pb-[calc(var(--tabbar)+env(safe-area-inset-bottom)+28px)]">
          <Outlet context={me.data} />
        </main>
      </div>
      <BottomNav account={me.data} />
    </div>
  )
}
