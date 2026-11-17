import { Router } from 'express'
import { z } from 'zod'
import { currentUser } from '../auth.js'
import { deviceJson, fixedLoadJson } from '../household.js'
import { HttpError, hueSchema, idParam, parse, quarter, wattsSchema } from '../http.js'
import { Device, FixedLoad } from '../models.js'

const nameSchema = z.string().trim().min(1, 'Falta el nombre').max(80)

// Aparatos

export const devicesRouter = Router()

const deviceSchema = z.object({
  name: nameSchema,
  watts: wattsSchema,
  // En cuartos de hora, como los usos que se proponen con ella
  defaultHours: z.number().min(0.25).max(24).refine(quarter, 'La duración debe ir en cuartos de hora'),
  hue: hueSchema,
})

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
  const data = parse(deviceSchema.partial(), req.body)
  const device = await ownDevice(currentUser(res).id, req.params.id)
  await device.update(data)
  res.json({ device: deviceJson(device) })
})

// Borra también sus usos y rutinas (ON DELETE CASCADE)
devicesRouter.delete('/:id', async (req, res) => {
  const device = await ownDevice(currentUser(res).id, req.params.id)
  await device.destroy()
  res.status(204).end()
})

// Consumos fijos

export const fixedLoadsRouter = Router()

const fixedLoadShape = {
  name: nameSchema,
  watts: wattsSchema,
  hue: hueSchema,
  note: z.string().trim().max(200),
}
// El valor por defecto va sólo al crear: en un cambio parcial borraría la nota que no se envía
const fixedLoadSchema = z.object({ ...fixedLoadShape, note: fixedLoadShape.note.default('') })
const fixedLoadUpdateSchema = z.object(fixedLoadShape).partial()

fixedLoadsRouter.get('/', async (_req, res) => {
  const loads = await FixedLoad.findAll({ where: { userId: currentUser(res).id }, order: [['createdAt', 'ASC']] })
  res.json({ fixedLoads: loads.map(fixedLoadJson) })
})

fixedLoadsRouter.post('/', async (req, res) => {
  const data = parse(fixedLoadSchema, req.body)
  const load = await FixedLoad.create({ ...data, userId: currentUser(res).id })
  res.status(201).json({ fixedLoad: fixedLoadJson(load) })
})

async function ownFixedLoad(userId, id) {
  const load = await FixedLoad.findOne({ where: { id: idParam(id), userId } })
  if (!load) throw new HttpError(404, 'No existe ese consumo fijo')
  return load
}

fixedLoadsRouter.patch('/:id', async (req, res) => {
  const data = parse(fixedLoadUpdateSchema, req.body)
  const load = await ownFixedLoad(currentUser(res).id, req.params.id)
  await load.update(data)
  res.json({ fixedLoad: fixedLoadJson(load) })
})

fixedLoadsRouter.delete('/:id', async (req, res) => {
  const load = await ownFixedLoad(currentUser(res).id, req.params.id)
  await load.destroy()
  res.status(204).end()
})
