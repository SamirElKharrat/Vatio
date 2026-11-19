import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { currentUser } from '../auth.js'
import { discountJson } from '../household.js'
import { HttpError, idParam, parse } from '../http.js'
import { DiscountEntry } from '../models.js'

/**
 * Descuentos de cada mes. Los apuntados a mano se crean, cambian y borran aquí; los que vienen de
 * una factura se crean al guardarla y se van con ella, así que aquí sólo se leen.
 */
export const discountsRouter = Router()

/** Un mes se escribe por su primer día: 2026-11-01 */
const monthSchema = z.iso.date().refine((value) => value.endsWith('-01'), 'El mes va como su día 1 (2026-11-01)')

const entryShape = {
  month: monthSchema,
  label: z.string().trim().min(1, 'Ponle un nombre al descuento').max(80),
  type: z.enum(['amount', 'percent']),
  value: z.number().min(0).max(100000),
  note: z.string().trim().max(200),
}
const percentMax = (entry) => entry.type !== 'percent' || entry.value === undefined || entry.value <= 100
const percentMessage = { message: 'Un porcentaje no puede pasar de 100', path: ['value'] }

const createSchema = z.object({ ...entryShape, note: entryShape.note.default('') }).refine(percentMax, percentMessage)
const updateSchema = z.object(entryShape).partial().refine(percentMax, percentMessage)
const listSchema = z.object({ from: monthSchema, to: monthSchema })

discountsRouter.get('/', async (req, res) => {
  const { from, to } = parse(listSchema, req.query)
  const entries = await DiscountEntry.findAll({
    where: { userId: currentUser(res).id, month: { [Op.between]: [from, to] } },
    order: [
      ['month', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  })
  res.json({ discounts: entries.map(discountJson) })
})

discountsRouter.post('/', async (req, res) => {
  const data = parse(createSchema, req.body)
  const entry = await DiscountEntry.create({ ...data, source: 'manual', userId: currentUser(res).id })
  res.status(201).json({ discount: discountJson(entry) })
})

/** Un descuento apuntado a mano de la cuenta; los de factura no se tocan desde aquí */
async function ownManualEntry(userId, id) {
  const entry = await DiscountEntry.findOne({ where: { id: idParam(id), userId } })
  if (!entry) throw new HttpError(404, 'No existe ese descuento')
  if (entry.source !== 'manual') {
    throw new HttpError(409, 'Este descuento viene de una factura: se cambia o se borra con ella, en Tarifa y factura.')
  }
  return entry
}

discountsRouter.patch('/:id', async (req, res) => {
  const data = parse(updateSchema, req.body)
  const entry = await ownManualEntry(currentUser(res).id, req.params.id)
  const merged = { type: entry.type, value: entry.value, ...data }
  if (!percentMax(merged)) throw new HttpError(400, percentMessage.message)
  await entry.update(data)
  res.json({ discount: discountJson(entry) })
})

discountsRouter.delete('/:id', async (req, res) => {
  const entry = await ownManualEntry(currentUser(res).id, req.params.id)
  await entry.destroy()
  res.status(204).end()
})

/**
 * Los descuentos que trae una factura, apuntados en el mes en que termina su periodo.
 * Se rehacen cada vez que se guarda la factura, para que coincidan con sus líneas.
 */
export async function syncInvoiceDiscounts(invoice, lines, transaction) {
  await DiscountEntry.destroy({ where: { invoiceId: invoice.id }, transaction })
  const month = `${invoice.periodTo.slice(0, 7)}-01`
  const entries = lines
    .filter((line) => line.kind === 'discount' && line.amount !== 0)
    .map((line) => ({
      userId: invoice.userId,
      month,
      label: line.label.slice(0, 80),
      type: 'amount',
      value: Math.abs(line.amount),
      source: 'factura',
      invoiceId: invoice.id,
    }))
  if (entries.length) await DiscountEntry.bulkCreate(entries, { transaction })
}
