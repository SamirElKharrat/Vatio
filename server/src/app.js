import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { requireAdmin, requireAuth, sessionMiddleware } from './auth.js'
import { config } from './config.js'
import { sequelize } from './db.js'
import { errorHandler, HttpError } from './http.js'
import { authRouter } from './routes/auth.js'
import { contractRouter, invoicesRouter } from './routes/billing.js'
import { devicesRouter, fixedLoadsRouter } from './routes/catalog.js'
import { routinesRouter } from './routes/routines.js'
import { usagesRouter } from './routes/usages.js'
import { usersRouter } from './routes/users.js'

export const app = express()

app.disable('x-powered-by')
// En Render la app va detrás de su proxy: sin esto Express no ve que la conexión es HTTPS
// y la cookie de sesión (que en producción exige HTTPS) no se llegaría a mandar
if (config.isProduction) app.set('trust proxy', 1)
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await sequelize.authenticate()
    res.json({ server: true, database: true })
  } catch {
    res.status(503).json({ server: true, database: false })
  }
})

app.use('/api', sessionMiddleware)
app.use('/api/auth', authRouter)

// Todo lo demás exige sesión y trabaja sólo con los datos de la cuenta que ha entrado
app.use('/api/devices', requireAuth, devicesRouter)
app.use('/api/fixed-loads', requireAuth, fixedLoadsRouter)
app.use('/api/usages', requireAuth, usagesRouter)
app.use('/api/routines', requireAuth, routinesRouter)
app.use('/api/contract', requireAuth, contractRouter)
app.use('/api/invoices', requireAuth, invoicesRouter)
app.use('/api/users', requireAuth, requireAdmin, usersRouter)

app.use('/api', () => {
  throw new HttpError(404, 'No encontrado')
})

// Con el cliente construido (`npm start`), el servidor entrega también la web.
// En desarrollo la sirve Vite y esto no hace falta.
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url))
if (existsSync(join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist))
  // Las direcciones de la app (/consumo/dia/…) las resuelve el cliente.
  // Un archivo que no existe (lleva extensión) sigue siendo un 404.
  app.get(/^[^.]*$/, (_req, res) => res.sendFile(join(clientDist, 'index.html')))
}

app.use(errorHandler)
