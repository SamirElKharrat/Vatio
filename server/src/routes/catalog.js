import { Router } from 'express'
import { UniqueConstraintError } from 'sequelize'
import { z } from 'zod'
import { currentUser } from '../auth.js'
import { deviceJson, fixedLoadJson } from '../household.js'
import { HttpError, colorSchema, idParam, parse, quarter, wattsSchema } from '../http.js'
import { Device, FixedLoad } from '../models.js'

const nameSchema = z.string().trim().min(1, 'Falta el nombre').max(80)

// Aparatos

export const devicesRouter = Router()

const deviceShape = {
  name: nameSchema,
  watts: wattsSchema,
  // En cuartos de hora, como los usos que se proponen con ella
  defaultHours: z.number().min(0.25).max(24).refine(quarter, 'La duración debe ir en cuartos de hora'),
  color: colorSchema,
  // Modo «kWh por uso»: lo que gasta cada uso; `null` vuelve a calcular con los vatios
  kwhPerUse: z.number().gt(0, 'Los kWh por uso tienen que ser más de 0').max(100).nullable(),
}
// El valor por defecto va sólo al crear: en un cambio parcial borraría los kWh que no se envían
const deviceSchema = z.object({ ...deviceShape, kwhPerUse: deviceShape.kwhPerUse.default(null) })
const deviceUpdateSchema = z.object(deviceShape).partial()

devicesRouter.get('/', async (_req, res) => {
  const devices = await Device.findAll({ where: { userId: currentUser(res).id }, order: [['createdAt', 'ASC']] })
  res.json({ devices: devices.map(deviceJson) })
})

devicesRouter.post('/', async (req, res) => {
  const data = parse(deviceSchema, req.body)
  const device = await Device.create({ ...data, userId: currentUser(res).id })
  res.status(201).json({ device: deviceJson(device) })
})

async function ownDevice(userId, id) {
  const device = await Device.findOne({ where: { id: idParam(id), userId } })
  if (!device) throw new HttpError(404, 'No existe ese aparato')
  return device
}

devicesRouter.patch('/:id', async (req, res) => {
  const data = parse(deviceUpdateSchema, req.body)
  const device = await ownDevice(currentUser(res).id, req.params.id)
  await device.update(data)
  res.json({ device: deviceJson(device) })
})

// Borra también sus usos, sus rutinas y, si lo era, su consumo fijo (ON DELETE CASCADE)
devicesRouter.delete('/:id', async (req, res) => {
  const device = await ownDevice(currentUser(res).id, req.params.id)
  await device.destroy()
  res.status(204).end()
})

// Consumos fijos: aparatos que están enchufados las 24 h

export const fixedLoadsRouter = Router()

const noteSchema = z.string().trim().max(200)
const fixedLoadSchema = z.object({ deviceId: z.uuid('Elige un aparato'), note: noteSchema.default('') })
// Sólo cambia la nota: los vatios, el nombre y el color se cambian en el aparato
const fixedLoadUpdateSchema = z.object({ note: noteSchema })
const withDevice = { include: [{ model: Device, as: 'device' }] }

fixedLoadsRouter.get('/', async (_req, res) => {
  // Los que se crearon a la vez (por ejemplo, en una migración) van por nombre, para que el orden no cambie
  const order = [['createdAt', 'ASC'], [{ model: Device, as: 'device' }, 'name', 'ASC']]
  const loads = await FixedLoad.findAll({ where: { userId: currentUser(res).id }, order, ...withDevice })
  res.json({ fixedLoads: loads.map(fixedLoadJson) })
})

fixedLoadsRouter.post('/', async (req, res) => {
  const data = parse(fixedLoadSchema, req.body)
  const userId = currentUser(res).id
  await ownDevice(userId, data.deviceId)
  if (await FixedLoad.findOne({ where: { deviceId: data.deviceId } })) {
    throw new HttpError(409, 'Ese aparato ya cuenta como consumo fijo')
  }
  const created = await FixedLoad.create({ ...data, userId }).catch((error) => {
    // Dos altas a la vez del mismo aparato: la segunda choca con el índice único
    if (error instanceof UniqueConstraintError) throw new HttpError(409, 'Ese aparato ya cuenta como consumo fijo')
    throw error
  })
  res.status(201).json({ fixedLoad: fixedLoadJson(await FixedLoad.findByPk(created.id, withDevice)) })
})

async function ownFixedLoad(userId, id) {
  const load = await FixedLoad.findOne({ where: { id: idParam(id), userId }, ...withDevice })
  if (!load) throw new HttpError(404, 'No existe ese consumo fijo')
  return load
}

fixedLoadsRouter.patch('/:id', async (req, res) => {
  const data = parse(fixedLoadUpdateSchema, req.body)
  const load = await ownFixedLoad(currentUser(res).id, req.params.id)
  await load.update(data)
  res.json({ fixedLoad: fixedLoadJson(load) })
})

// Deja de contar como fijo; el aparato se queda
fixedLoadsRouter.delete('/:id', async (req, res) => {
  const load = await ownFixedLoad(currentUser(res).id, req.params.id)
  await load.destroy()
  res.status(204).end()
})
