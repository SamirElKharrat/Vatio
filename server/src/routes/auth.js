import { Router } from 'express'
import { z } from 'zod'
import { checkPassword, currentUser, hashPassword, publicUser, requireAuth } from '../auth.js'
import { HttpError, parse } from '../http.js'
import { User } from '../models.js'

export const authRouter = Router()

const loginSchema = z.object({ email: z.string().min(1), password: z.string().min(1) })

// Hash de relleno para tardar lo mismo cuando la cuenta no existe
const dummyHash = hashPassword('cuenta-inexistente')

// Freno para quien prueba contraseñas a ciegas: tras MAX_FAILURES fallos con un correo, ese
// correo espera LOCK_MS. Va por correo y no por IP porque detrás del proxy todas las peticiones
// pueden llegar con la misma. Se guarda en memoria, que basta con un solo servidor.
const MAX_FAILURES = 10
const LOCK_MS = 15 * 60 * 1000
const failures = new Map()

function assertNotLocked(email) {
  const entry = failures.get(email)
  if (!entry) return
  if (Date.now() - entry.since > LOCK_MS) failures.delete(email)
  else if (entry.count >= MAX_FAILURES) {
    throw new HttpError(429, 'Demasiados intentos con este correo. Espera unos minutos y vuelve a probar.')
  }
}

function recordFailure(email) {
  const entry = failures.get(email) ?? { count: 0, since: Date.now() }
  entry.count++
  failures.set(email, entry)
  // Que la lista no crezca sin fin con correos inventados
  if (failures.size > 5000) {
    for (const [key, value] of failures) if (Date.now() - value.since > LOCK_MS) failures.delete(key)
  }
}

authRouter.post('/login', async (req, res) => {
  const { password, ...input } = parse(loginSchema, req.body)
  const email = input.email.trim().toLowerCase()
  assertNotLocked(email)
  const user = await User.findOne({ where: { email } })
  const matches = await checkPassword(password, user?.passwordHash ?? (await dummyHash))
  if (!user || !matches) {
    recordFailure(email)
    throw new HttpError(401, 'Correo o contraseña incorrectos')
  }
  failures.delete(email)
  if (!user.active) throw new HttpError(403, 'Esta cuenta está desactivada')

  // Sesión nueva al entrar, para no heredar un identificador anterior
  await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())))
  req.session.userId = user.id
  res.json({ user: publicUser(user) })
})

authRouter.post('/logout', async (req, res) => {
  await new Promise((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())))
  res.clearCookie('vatios.sid')
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ user: publicUser(currentUser(res)) })
})
