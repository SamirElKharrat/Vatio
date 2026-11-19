import bcrypt from 'bcryptjs'
import connectPgSimple from 'connect-pg-simple'
import session from 'express-session'
import { config } from './config.js'
import { ssl } from './db.js'
import { HttpError } from './http.js'
import { User } from './models.js'

const PgStore = connectPgSimple(session)

// La tabla `session` la crea la migración inicial
export const sessionStore = new PgStore({
  conObject: { connectionString: config.databaseUrl, ssl, max: 3 },
})

export const sessionMiddleware = session({
  store: sessionStore,
  name: 'vatios.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
})

export const hashPassword = (password) => bcrypt.hash(password, config.isTest ? 4 : 12)
export const checkPassword = (password, hash) => bcrypt.compare(password, hash)

/** Exige sesión de una cuenta activa y deja el usuario en `res.locals.user` */
export const requireAuth = async (req, res, next) => {
  const user = req.session.userId ? await User.findByPk(req.session.userId) : null
  if (!user || !user.active) throw new HttpError(401, 'Inicia sesión para continuar')
  res.locals.user = user
  next()
}

export const requireAdmin = (_req, res, next) => {
  if (currentUser(res).role !== 'admin') throw new HttpError(403, 'Sólo el administrador puede hacer esto')
  next()
}

export const currentUser = (res) => res.locals.user

export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  householdName: user.householdName,
  role: user.role,
  active: user.active,
  createdAt: user.createdAt,
})
