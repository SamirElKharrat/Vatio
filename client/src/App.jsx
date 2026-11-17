import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { ApiError } from './api/client'
import { keys } from './api/hooks'
import { AppShell } from './components/layout/AppShell'
import { Loading } from './components/ui/Notice'
import { LoginPage } from './features/auth/LoginPage'
import { ConsumoPage } from './features/consumo/ConsumoPage'
import { todayISO } from './lib/dates'
import { consumoPath } from './lib/useSelectedDate'

// Si el servidor dice que la sesión ya no vale, la app vuelve a la pantalla de entrada
function onApiError(error) {
  if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(keys.me, null)
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failures, error) => !(error instanceof ApiError && error.status >= 400) && failures < 2,
    },
  },
})

// Consumo es la pestaña de entrada y va en el primer paquete; las demás se descargan al abrirlas
const AparatosPage = lazy(() => import('./features/aparatos/AparatosPage').then((m) => ({ default: m.AparatosPage })))
const FijosPage = lazy(() => import('./features/fijos/FijosPage').then((m) => ({ default: m.FijosPage })))
const TarifaPage = lazy(() => import('./features/tarifa/TarifaPage').then((m) => ({ default: m.TarifaPage })))
const ProfilePage = lazy(() => import('./features/account/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const AccountsPage = lazy(() => import('./features/accounts/AccountsPage').then((m) => ({ default: m.AccountsPage })))

const onDemand = (page) => (
  <Suspense fallback={<Loading />}>{page}</Suspense>
)

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to={consumoPath('dia', todayISO())} replace /> },
      { path: 'consumo', element: <Navigate to={consumoPath('dia', todayISO())} replace /> },
      { path: 'consumo/:span/:date', element: <ConsumoPage /> },
      { path: 'aparatos', element: onDemand(<AparatosPage />) },
      { path: 'fijos', element: onDemand(<FijosPage />) },
      { path: 'tarifa', element: onDemand(<TarifaPage />) },
      { path: 'cuentas', element: onDemand(<AccountsPage />) },
      { path: 'cuenta', element: onDemand(<ProfilePage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
