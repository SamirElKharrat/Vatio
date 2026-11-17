// Crea las dos cuentas iniciales, vacías: cada persona apunta después sus aparatos y su contrato.
// Se puede ejecutar varias veces: no toca las cuentas que ya existen.
import { hashPassword } from './auth.js'
import { sequelize } from './db.js'
import { createEmptyHousehold } from './household.js'
import { User } from './models.js'

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
    await createEmptyHousehold(user.id, transaction)
  })
  console.log(`Creada la cuenta ${email} (${role === 'admin' ? 'administrador' : 'normal'})`)
}

await seedAccount('admin', 'ADMIN_EMAIL', 'ADMIN_PASSWORD')
await seedAccount('user', 'USER_EMAIL', 'USER_PASSWORD')
await sequelize.close()
