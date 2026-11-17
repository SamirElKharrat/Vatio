import { DataTypes, Model } from 'sequelize'
import { sequelize } from './db.js'

// El esquema real lo crean las migraciones; aquí sólo se describe para Sequelize.
const id = { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }
const timestamps = { createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE }
const userId = { type: DataTypes.UUID, allowNull: false }

export class User extends Model {}
User.init(
  {
    id,
    email: { type: DataTypes.TEXT, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.TEXT, allowNull: false },
    role: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'user' },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...timestamps,
  },
  { sequelize, tableName: 'users' },
)

export class Device extends Model {}
Device.init(
  {
    id,
    userId,
    name: { type: DataTypes.TEXT, allowNull: false },
    watts: { type: DataTypes.INTEGER, allowNull: false },
    defaultHours: { type: DataTypes.DOUBLE, allowNull: false },
    color: { type: DataTypes.TEXT, allowNull: false },
    ...timestamps,
  },
  { sequelize, tableName: 'devices' },
)

export class Usage extends Model {}
Usage.init(
  {
    id,
    userId,
    deviceId: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    start: { type: DataTypes.DOUBLE, allowNull: false },
    hours: { type: DataTypes.DOUBLE, allowNull: false },
    ...timestamps,
  },
  { sequelize, tableName: 'usages' },
)

export class FixedLoad extends Model {}
FixedLoad.init(
  {
    id,
    userId,
    name: { type: DataTypes.TEXT, allowNull: false },
    watts: { type: DataTypes.INTEGER, allowNull: false },
    color: { type: DataTypes.TEXT, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    ...timestamps,
  },
  { sequelize, tableName: 'fixed_loads' },
)

export class RoutineSkip extends Model {}
RoutineSkip.init(
  {
    routineId: { type: DataTypes.UUID, primaryKey: true },
    date: { type: DataTypes.DATEONLY, primaryKey: true },
  },
  { sequelize, tableName: 'routine_skips', timestamps: false },
)

export class Routine extends Model {}
Routine.init(
  {
    id,
    userId,
    name: { type: DataTypes.TEXT, allowNull: false },
    deviceId: { type: DataTypes.UUID, allowNull: false },
    start: { type: DataTypes.DOUBLE, allowNull: false },
    hours: { type: DataTypes.DOUBLE, allowNull: false },
    weekdays: { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    pausedFrom: { type: DataTypes.DATEONLY, allowNull: true },
    ...timestamps,
  },
  { sequelize, tableName: 'routines' },
)

export class Contract extends Model {}
Contract.init(
  {
    id,
    userId,
    provider: { type: DataTypes.TEXT, allowNull: true },
    mode: { type: DataTypes.TEXT, allowNull: false },
    fixedPrice: { type: DataTypes.DOUBLE, allowNull: false },
    pricePunta: { type: DataTypes.DOUBLE, allowNull: false },
    priceLlano: { type: DataTypes.DOUBLE, allowNull: false },
    priceValle: { type: DataTypes.DOUBLE, allowNull: false },
    powerKwPuntaLlano: { type: DataTypes.DOUBLE, allowNull: false },
    powerKwValle: { type: DataTypes.DOUBLE, allowNull: false },
    powerPricePuntaLlano: { type: DataTypes.DOUBLE, allowNull: false },
    powerPriceValle: { type: DataTypes.DOUBLE, allowNull: false },
    discounts: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    dailyFees: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    electricityTaxPct: { type: DataTypes.DOUBLE, allowNull: false },
    supplyTaxPct: { type: DataTypes.DOUBLE, allowNull: false },
    ...timestamps,
  },
  { sequelize, tableName: 'contracts' },
)

export class InvoiceLine extends Model {}
InvoiceLine.init(
  {
    id,
    invoiceId: { type: DataTypes.UUID, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    kind: { type: DataTypes.TEXT, allowNull: false },
    label: { type: DataTypes.TEXT, allowNull: false },
    amount: { type: DataTypes.DOUBLE, allowNull: false },
    taxPct: { type: DataTypes.DOUBLE, allowNull: true },
  },
  { sequelize, tableName: 'invoice_lines', timestamps: false },
)

export class Invoice extends Model {}
Invoice.init(
  {
    id,
    userId,
    provider: { type: DataTypes.TEXT, allowNull: true },
    periodFrom: { type: DataTypes.DATEONLY, allowNull: false },
    periodTo: { type: DataTypes.DATEONLY, allowNull: false },
    days: { type: DataTypes.INTEGER, allowNull: true },
    total: { type: DataTypes.DOUBLE, allowNull: false },
    kwh: { type: DataTypes.DOUBLE, allowNull: false },
    kwhPunta: { type: DataTypes.DOUBLE, allowNull: true },
    kwhLlano: { type: DataTypes.DOUBLE, allowNull: true },
    kwhValle: { type: DataTypes.DOUBLE, allowNull: true },
    ...timestamps,
  },
  { sequelize, tableName: 'invoices' },
)

Routine.hasMany(RoutineSkip, { as: 'skips', foreignKey: 'routineId' })
Invoice.hasMany(InvoiceLine, { as: 'lines', foreignKey: 'invoiceId' })
