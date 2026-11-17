import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { currentUser } from '../auth.js'
import { sequelize } from '../db.js'
import { contractJson, invoiceJson } from '../household.js'
import { dateSchema, HttpError, idParam, parse } from '../http.js'
import { parseInvoicePdf } from '../invoices/index.js'
import { Contract, Invoice, InvoiceLine } from '../models.js'

const price = z.number().min(0).max(10)
const pct = z.number().min(0).max(100)
const label = z.string().trim().min(1).max(80)
const provider = z.string().trim().min(1).max(40).nullable().default(null)

// Contrato

export const contractRouter = Router()

const powerTerm = z.object({ kw: z.number().min(0).max(100), pricePerKwDay: price })

const contractSchema = z.object({
  provider,
  mode: z.enum(['fija', 'tramos']),
  fixedPrice: price,
  prices: z.object({ punta: price, llano: price, valle: price }),
  power: z.object({ puntaLlano: powerTerm, valle: powerTerm }),
  discounts: z
    .array(
      z.discriminatedUnion('type', [
        z.object({ label, type: z.literal('percent'), pct }),
        z.object({ label, type: z.literal('amount'), amount: z.number().min(0) }),
      ]),
    )
    .max(20),
  dailyFees: z
    .array(z.object({ label, pricePerDay: price, inElectricityTaxBase: z.boolean(), taxPct: pct }))
    .max(20),
  electricityTaxPct: pct,
  supplyTaxPct: pct,
})

async function ownContract(userId) {
  const contract = await Contract.findOne({ where: { userId } })
  if (!contract) throw new HttpError(404, 'Esta cuenta no tiene contrato')
  return contract
}

contractRouter.get('/', async (_req, res) => {
  res.json({ contract: contractJson(await ownContract(currentUser(res).id)) })
})

contractRouter.put('/', async (req, res) => {
  const data = parse(contractSchema, req.body)
  const contract = await ownContract(currentUser(res).id)
  await contract.update({
    provider: data.provider,
    mode: data.mode,
    fixedPrice: data.fixedPrice,
    pricePunta: data.prices.punta,
    priceLlano: data.prices.llano,
    priceValle: data.prices.valle,
    powerKwPuntaLlano: data.power.puntaLlano.kw,
    powerPricePuntaLlano: data.power.puntaLlano.pricePerKwDay,
    powerKwValle: data.power.valle.kw,
    powerPriceValle: data.power.valle.pricePerKwDay,
    discounts: data.discounts,
    dailyFees: data.dailyFees,
    electricityTaxPct: data.electricityTaxPct,
    supplyTaxPct: data.supplyTaxPct,
  })
  res.json({ contract: contractJson(contract) })
})

// Facturas

export const invoicesRouter = Router()

const kwh = z.number().min(0).max(100000)

const invoiceSchema = z
  .object({
    provider,
    from: dateSchema,
    to: dateSchema,
    /** Días facturados; si no se indican, se cuentan del inicio al fin */
    days: z.number().int().min(1).max(400).nullable().default(null),
    total: z.number().min(0).max(100000),
    kwh,
    kwhByBand: z.object({ punta: kwh, llano: kwh, valle: kwh }).nullable().default(null),
    lines: z
      .array(
        z.object({
          kind: z.enum(['power', 'energy', 'discount', 'fee', 'oneoff', 'electricityTax', 'tax', 'adjustment']),
          label,
          amount: z.number().min(-100000).max(100000),
          taxPct: pct.nullable().default(null),
        }),
      )
      .max(60)
      .default([]),
  })
  .refine((invoice) => invoice.to >= invoice.from, {
    message: 'La fecha de fin debe ser igual o posterior a la de inicio',
    path: ['to'],
  })

const withLines = { include: [{ model: InvoiceLine, as: 'lines' }] }

const invoiceFields = (data) => ({
  provider: data.provider,
  periodFrom: data.from,
  periodTo: data.to,
  days: data.days,
  total: data.total,
  kwh: data.kwh,
  kwhPunta: data.kwhByBand?.punta ?? null,
  kwhLlano: data.kwhByBand?.llano ?? null,
  kwhValle: data.kwhByBand?.valle ?? null,
})

async function ownInvoice(userId, id) {
  const invoice = await Invoice.findOne({ where: { id: idParam(id), userId }, ...withLines })
  if (!invoice) throw new HttpError(404, 'No existe esa factura')
  return invoice
}

// El PDF se lee en memoria y se descarta: sólo viajan de vuelta los datos encontrados
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } })
const parseSchema = z.object({ provider: z.enum(['endesa', 'disa']), password: z.string().max(200).optional() })

/** Lee una factura en PDF y devuelve lo que ha encontrado, sin guardar nada */
invoicesRouter.post('/parse', upload.single('file'), async (req, res) => {
  const { provider, password } = parse(parseSchema, req.body)
  if (!req.file) throw new HttpError(400, 'Elige el PDF de la factura')
  res.json({ parsed: await parseInvoicePdf(new Uint8Array(req.file.buffer), provider, password) })
})

invoicesRouter.get('/', async (_req, res) => {
  const invoices = await Invoice.findAll({
    where: { userId: currentUser(res).id },
    order: [['periodFrom', 'DESC']],
    ...withLines,
  })
  res.json({ invoices: invoices.map(invoiceJson) })
})

invoicesRouter.post('/', async (req, res) => {
  const data = parse(invoiceSchema, req.body)
  const userId = currentUser(res).id
  const id = await sequelize.transaction(async (transaction) => {
    const invoice = await Invoice.create({ ...invoiceFields(data), userId }, { transaction })
    await InvoiceLine.bulkCreate(
      data.lines.map((line, position) => ({ ...line, position, invoiceId: invoice.id })),
      { transaction },
    )
    return invoice.id
  })
  res.status(201).json({ invoice: invoiceJson(await ownInvoice(userId, id)) })
})

invoicesRouter.put('/:id', async (req, res) => {
  const data = parse(invoiceSchema, req.body)
  const userId = currentUser(res).id
  const invoice = await ownInvoice(userId, req.params.id)
  await sequelize.transaction(async (transaction) => {
    await invoice.update(invoiceFields(data), { transaction })
    await InvoiceLine.destroy({ where: { invoiceId: invoice.id }, transaction })
    await InvoiceLine.bulkCreate(
      data.lines.map((line, position) => ({ ...line, position, invoiceId: invoice.id })),
      { transaction },
    )
  })
  res.json({ invoice: invoiceJson(await ownInvoice(userId, invoice.id)) })
})

invoicesRouter.delete('/:id', async (req, res) => {
  const invoice = await ownInvoice(currentUser(res).id, req.params.id)
  await invoice.destroy()
  res.status(204).end()
})
