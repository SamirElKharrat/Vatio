import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { currentUser } from '../auth.js'
import { usageJson } from '../household.js'
import { dateSchema, HttpError, idParam, parse, rangeShape, withinDay, withinDayMessage } from '../http.js'
import { Device, Usage } from '../models.js'

export const usagesRouter = Router()

const usageShape = {
  deviceId: z.uuid(),
  date: dateSchema,
  ...rangeShape,
  // Sólo para aparatos en modo kWh por uso: lo que gastó este uso y un comentario opcional con el ciclo
  kwh: z.number().gt(0).max(100).nullable(),
  note: z.string().trim().max(120, 'El comentario no puede pasar de 120 caracteres'),
}
const createSchema = z
  .object({ ...usageShape, kwh: usageShape.kwh.default(null), note: usageShape.note.default('') })
  .refine(withinDay, withinDayMessage)
const updateSchema = z.object(usageShape).partial()
// Tope de días por consulta: el periodo de una factura larga cabe; la descarga en CSV se queda en 3 meses
const MAX_RANGE_DAYS = 400
const DAY_MS = 24 * 60 * 60 * 1000
const listSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine(({ from, to }) => to >= from, { message: 'La fecha final no puede ser anterior a la inicial', path: ['to'] })
  .refine(({ from, to }) => (Date.parse(to) - Date.parse(from)) / DAY_MS < MAX_RANGE_DAYS, {
    message: `Como máximo ${MAX_RANGE_DAYS} días por consulta`,
    path: ['to'],
  })

const EPS = 1e-9

/** Comprueba que el aparato es de la cuenta y que no hay otro uso suyo en esa franja */
async function assertFits(userId, usage, ignoreId) {
  const device = await Device.findOne({ where: { id: usage.deviceId, userId } })
  if (!device) throw new HttpError(400, 'No existe ese aparato')

  const sameDay = await Usage.findAll({ where: { userId, deviceId: usage.deviceId, date: usage.date } })
  const clash = sameDay.some(
    (other) =>
      other.id !== ignoreId &&
      usage.start < other.start + other.hours - EPS &&
      other.start < usage.start + usage.hours - EPS,
  )
  if (clash) throw new HttpError(409, 'Ya hay un uso de este aparato en esa franja')
}

usagesRouter.get('/', async (req, res) => {
  const { from, to } = parse(listSchema, req.query)
  const usages = await Usage.findAll({
    where: { userId: currentUser(res).id, date: { [Op.between]: [from, to] } },
    order: [
      ['date', 'ASC'],
      ['start', 'ASC'],
    ],
  })
  res.json({ usages: usages.map(usageJson) })
})

usagesRouter.post('/', async (req, res) => {
  const data = parse(createSchema, req.body)
  const userId = currentUser(res).id
  await assertFits(userId, data)
  const usage = await Usage.create({ ...data, userId })
  await rememberHours(userId, usage.deviceId, usage.hours)
  res.status(201).json({ usage: usageJson(usage) })
})

/**
 * El aparato recuerda lo que duró su último uso apuntado a mano: es lo que se propone la próxima vez
 * que se apunte. Ya no se escribe en el editor del aparato.
 */
async function rememberHours(userId, deviceId, hours) {
  await Device.update({ defaultHours: hours }, { where: { id: deviceId, userId } })
}

async function ownUsage(userId, id) {
  const usage = await Usage.findOne({ where: { id: idParam(id), userId } })
  if (!usage) throw new HttpError(404, 'No existe ese uso')
  return usage
}

usagesRouter.patch('/:id', async (req, res) => {
  const data = parse(updateSchema, req.body)
  const userId = currentUser(res).id
  const usage = await ownUsage(userId, req.params.id)

  const next = {
    deviceId: data.deviceId ?? usage.deviceId,
    date: data.date ?? usage.date,
    start: data.start ?? usage.start,
    hours: data.hours ?? usage.hours,
  }
  if (!withinDay(next)) throw new HttpError(400, 'Datos no válidos', [{ path: 'hours', message: withinDayMessage.message }])
  await assertFits(userId, next, usage.id)

  const extra = {}
  if (data.kwh !== undefined) extra.kwh = data.kwh
  if (data.note !== undefined) extra.note = data.note
  await usage.update({ ...next, ...extra })
  if (data.hours !== undefined) await rememberHours(userId, next.deviceId, next.hours)
  res.json({ usage: usageJson(usage) })
})

usagesRouter.delete('/:id', async (req, res) => {
  const usage = await ownUsage(currentUser(res).id, req.params.id)
  await usage.destroy()
  res.status(204).end()
})
