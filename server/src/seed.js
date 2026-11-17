// Crea las dos cuentas iniciales y les deja la semana de ejemplo del prototipo.
// Se puede ejecutar varias veces: no toca las cuentas que ya existen.
import { hashPassword } from './auth.js'
import { sequelize } from './db.js'
import { createStarterHousehold } from './household.js'
import { Routine, Usage, User } from './models.js'

const toISO = (date) => date.toISOString().slice(0, 10)

/** Fecha del día de esta semana con ese índice (0 = lunes) */
function thisWeek(weekday) {
  const today = new Date()
  const monday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + weekday)
  return toISO(monday)
}

// [aparato, día de la semana, inicio, horas]
const EXAMPLE_USAGES = [
  ['Termo eléctrico', 0, 6, 1.5],
  ['Vitrocerámica', 0, 14, 0.75],
  ['Aire acondicionado', 0, 16, 2.5],
  ['Lavadora', 0, 19, 2],
  ['Horno', 0, 20, 1],
  ['Lavavajillas', 0, 22.5, 1.5],
  ['Termo eléctrico', 1, 5.5, 1.5],
  ['Lavadora', 1, 9, 2],
  ['Secadora', 1, 11.5, 1.5],
  ['Vitrocerámica', 1, 13.5, 1],
  ['Lavavajillas', 1, 15.5, 1.5],
  ['Horno', 5, 12, 1.5],
  ['Lavadora', 5, 10, 2],
  ['Aire acondicionado', 5, 15, 4],
]

const EXAMPLE_ROUTINES = [
  {
    name: 'Termo · enchufe inteligente',
    device: 'Termo eléctrico',
    start: 14,
    hours: 1.5,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    note: 'Programado en el enchufe: no tocar el interruptor de la pared.',
  },
  {
    name: 'Lavavajillas de noche',
    device: 'Lavavajillas',
    start: 22,
    hours: 1.5,
    weekdays: [0, 2, 4],
    note: 'Modo eco, se deja cargado después de cenar.',
  },
  { name: 'Lavadora del finde', device: 'Lavadora', start: 10, hours: 2, weekdays: [5, 6], note: '' },
]

async function seedAccount(role, emailVar, passwordVar) {
  const email = process.env[emailVar]?.trim().toLowerCase()
  const password = process.env[passwordVar]
  if (!email || !password) throw new Error(`Rellena ${emailVar} y ${passwordVar} en server/.env`)
  if (password.length < 8) throw new Error(`${passwordVar} debe tener al menos 8 caracteres`)

  if (await User.findOne({ where: { email } })) {
    console.log(`Ya existe ${email}; no se toca`)
    return
  }

  const passwordHash = await hashPassword(password)
  await sequelize.transaction(async (transaction) => {
    const user = await User.create({ email, passwordHash, role }, { transaction })
    const devices = await createStarterHousehold(user.id, transaction)
    const deviceId = (name) => devices.find((device) => device.name === name).id

    await Usage.bulkCreate(
      EXAMPLE_USAGES.map(([device, weekday, start, hours]) => ({
        userId: user.id,
        deviceId: deviceId(device),
        date: thisWeek(weekday),
        start,
        hours,
      })),
      { transaction },
    )
    await Routine.bulkCreate(
      EXAMPLE_ROUTINES.map(({ device, ...routine }) => ({ ...routine, userId: user.id, deviceId: deviceId(device) })),
      { transaction },
    )
  })
  console.log(`Creada la cuenta ${email} (${role === 'admin' ? 'administrador' : 'normal'})`)
}

await seedAccount('admin', 'ADMIN_EMAIL', 'ADMIN_PASSWORD')
await seedAccount('user', 'USER_EMAIL', 'USER_PASSWORD')
await sequelize.close()
