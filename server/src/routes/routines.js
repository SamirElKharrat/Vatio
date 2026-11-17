import { Router } from 'express'
import { z } from 'zod'
import { currentUser } from '../auth.js'
import { sequelize } from '../db.js'
import { routineJson, usageJson } from '../household.js'
import { dateSchema, HttpError, idParam, parse, rangeShape, withinDay, withinDayMessage } from '../http.js'
import { Device, Routine, RoutineSkip, Usage } from '../models.js'

export const routinesRouter = Router()

const routineShape = {
  name: z.string().trim().min(1, 'Falta el nombre').max(80),
  deviceId: z.uuid(),
  ...rangeShape,
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Elige al menos un día')
    .refine((days) => new Set(days).size === days.length, 'Hay días repetidos'),
  note: z.string().trim().max(300),
  pausedFrom: dateSchema.nullable(),
}
// Los valores por defecto van sólo al crear: en un cambio parcial borrarían lo que no se envía
const createSchema = z
  .object({ ...routineShape, note: routineShape.note.default(''), pausedFrom: routineShape.pausedFrom.default(null) })
  .refine(withinDay, withinDayMessage)
const updateSchema = z.object(routineShape).partial()

const withSkips = { include: [{ model: RoutineSkip, as: 'skips' }] }

async function assertOwnDevice(userId, deviceId) {
  if (!(await Device.findOne({ where: { id: deviceId, userId } }))) throw new HttpError(400, 'No existe ese aparato')
}

async function ownRoutine(userId, id) {
  const routine = await Routine.findOne({ where: { id: idParam(id), userId }, ...withSkips })
  if (!routine) throw new HttpError(404, 'No existe esa rutina')
  return routine
}

routinesRouter.get('/', async (_req, res) => {
  const routines = await Routine.findAll({
    where: { userId: currentUser(res).id },
    order: [['createdAt', 'ASC']],
    ...withSkips,
  })
  res.json({ routines: routines.map(routineJson) })
})

routinesRouter.post('/', async (req, res) => {
  const data = parse(createSchema, req.body)
  const userId = currentUser(res).id
  await assertOwnDevice(userId, data.deviceId)
  const routine = await Routine.create({ ...data, userId })
  res.status(201).json({ routine: routineJson(routine) })
})

routinesRouter.patch('/:id', async (req, res) => {
  const data = parse(updateSchema, req.body)
  const userId = currentUser(res).id
  const routine = await ownRoutine(userId, req.params.id)

  if (data.deviceId) await assertOwnDevice(userId, data.deviceId)
  const range = { start: data.start ?? routine.start, hours: data.hours ?? routine.hours }
  if (!withinDay(range)) throw new HttpError(400, 'Datos no válidos', [{ path: 'hours', message: withinDayMessage.message }])

  await routine.update(data)
  res.json({ routine: routineJson(routine) })
})

routinesRouter.delete('/:id', async (req, res) => {
  const routine = await ownRoutine(currentUser(res).id, req.params.id)
  await routine.destroy()
  res.status(204).end()
})

// «Saltar hoy»: la rutina no se apunta ese día

routinesRouter.put('/:id/skips/:date', async (req, res) => {
  const date = parse(dateSchema, req.params.date)
  const routine = await ownRoutine(currentUser(res).id, req.params.id)
  await RoutineSkip.findOrCreate({ where: { routineId: routine.id, date } })
  res.json({ routine: routineJson(await ownRoutine(currentUser(res).id, routine.id)) })
})

routinesRouter.delete('/:id/skips/:date', async (req, res) => {
  const date = parse(dateSchema, req.params.date)
  const routine = await ownRoutine(currentUser(res).id, req.params.id)
  await RoutineSkip.destroy({ where: { routineId: routine.id, date } })
  res.json({ routine: routineJson(await ownRoutine(currentUser(res).id, routine.id)) })
})

// «Cambiar este día» o «esta semana»: en esas fechas la rutina se salta y en su lugar
// queda un uso apuntado con otras horas, que ya se edita como cualquier otro

const overrideSchema = z
  .object({
    dates: z
      .array(dateSchema)
      .min(1)
      .max(7)
      .refine((dates) => new Set(dates).size === dates.length, 'Hay fechas repetidas'),
    ...rangeShape,
  })
  .refine(withinDay, withinDayMessage)

/** Igual que en el cliente: los días de la semana, la pausa y los saltos */
const runsOn = (routine, date) =>
  routine.weekdays.includes((new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7) &&
  !(routine.pausedFrom && date >= routine.pausedFrom) &&
  !(routine.skips ?? []).some((skip) => skip.date === date)

const EPS = 1e-9

routinesRouter.post('/:id/overrides', async (req, res) => {
  const { dates, start, hours } = parse(overrideSchema, req.body)
  const userId = currentUser(res).id
  const routine = await ownRoutine(userId, req.params.id)

  const notRunning = dates.find((date) => !runsOn(routine, date))
  if (notRunning) throw new HttpError(400, `La rutina no se apunta el ${notRunning}`)

  const sameDays = await Usage.findAll({ where: { userId, deviceId: routine.deviceId, date: dates } })
  const clash = sameDays.find((other) => start < other.start + other.hours - EPS && other.start < start + hours - EPS)
  if (clash) throw new HttpError(409, `El ${clash.date} ya hay un uso de este aparato en esa franja`)

  const usages = await sequelize.transaction(async (transaction) => {
    await RoutineSkip.bulkCreate(
      dates.map((date) => ({ routineId: routine.id, date })),
      { transaction },
    )
    return Usage.bulkCreate(
      dates.map((date) => ({ userId, deviceId: routine.deviceId, date, start, hours })),
      { transaction },
    )
  })
  res.status(201).json({
    routine: routineJson(await ownRoutine(userId, routine.id)),
    usages: usages.map(usageJson),
  })
})
