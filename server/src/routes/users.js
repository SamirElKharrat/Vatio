import { Router } from 'express'
import { UniqueConstraintError } from 'sequelize'
import { z } from 'zod'
import { currentUser, hashPassword, publicUser } from '../auth.js'
import { sequelize } from '../db.js'
import { createEmptyHousehold } from '../household.js'
import { HttpError, idParam, parse } from '../http.js'
import { User } from '../models.js'

/** Gestión de cuentas. Sólo para el administrador; no da acceso a los datos de las demás cuentas. */
export const usersRouter = Router()

const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200)
const roleSchema = z.enum(['admin', 'user'])

const createSchema = z.object({
  email: z.email('Escribe un correo válido'),
  password: passwordSchema,
  role: roleSchema.default('user'),
})

const updateSchema = z
  .object({ active: z.boolean(), role: roleSchema, password: passwordSchema })
  .partial()

usersRouter.get('/', async (_req, res) => {
  const users = await User.findAll({ order: [['createdAt', 'ASC']] })
  res.json({ users: users.map(publicUser) })
})

usersRouter.post('/', async (req, res) => {
  const data = parse(createSchema, req.body)
  const email = data.email.trim().toLowerCase()
  if (await User.findOne({ where: { email } })) throw new HttpError(409, 'Ya existe una cuenta con ese correo')

  const passwordHash = await hashPassword(data.password)
  const user = await sequelize
    .transaction(async (transaction) => {
      const created = await User.create({ email, passwordHash, role: data.role }, { transaction })
      await createEmptyHousehold(created.id, transaction)
      return created
    })
    .catch((error) => {
      // Dos altas a la vez con el mismo correo: la segunda choca con el índice único
      if (error instanceof UniqueConstraintError) throw new HttpError(409, 'Ya existe una cuenta con ese correo')
      throw error
    })
  res.status(201).json({ user: publicUser(user) })
})

usersRouter.patch('/:id', async (req, res) => {
  const data = parse(updateSchema, req.body)
  const user = await User.findByPk(idParam(req.params.id))
  if (!user) throw new HttpError(404, 'No existe esa cuenta')

  const isSelf = user.id === currentUser(res).id
  if (isSelf && data.active === false) throw new HttpError(400, 'No puedes desactivar tu propia cuenta')
  if (isSelf && data.role === 'user') throw new HttpError(400, 'No puedes quitarte el rol de administrador')

  if (data.active !== undefined) user.active = data.active
  if (data.role !== undefined) user.role = data.role
  if (data.password !== undefined) user.passwordHash = await hashPassword(data.password)
  await user.save()

  // Con la contraseña cambiada, las sesiones abiertas con la anterior dejan de valer.
  // Si es la propia, se conserva sólo la sesión desde la que se cambia.
  if (data.password !== undefined) {
    await sequelize.query(`DELETE FROM session WHERE sess->>'userId' = :userId AND sid <> :sid`, {
      replacements: { userId: user.id, sid: req.sessionID },
    })
  }
  res.json({ user: publicUser(user) })
})
