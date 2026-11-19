import { fileURLToPath } from 'node:url'
import { SequelizeStorage, Umzug } from 'umzug'
import { sequelize } from './db.js'
import * as initial from './migrations/001-initial.js'
import * as invoiceDays from './migrations/002-invoice-days.js'
import * as rowLevelSecurity from './migrations/003-row-level-security.js'
import * as deviceColors from './migrations/004-device-colors.js'
import * as userName from './migrations/005-user-name.js'
import * as fixedLoadDevice from './migrations/006-fixed-load-device.js'
import * as householdName from './migrations/007-household-name.js'
import * as discountEntries from './migrations/008-discount-entries.js'

// Las migraciones se importan a mano y en orden: así funcionan igual con node y en los tests.
const migrations = [
  { name: '001-initial', ...initial },
  { name: '002-invoice-days', ...invoiceDays },
  { name: '003-row-level-security', ...rowLevelSecurity },
  { name: '004-device-colors', ...deviceColors },
  { name: '005-user-name', ...userName },
  { name: '006-fixed-load-device', ...fixedLoadDevice },
  { name: '007-household-name', ...householdName },
  { name: '008-discount-entries', ...discountEntries },
]

export const migrator = new Umzug({
  migrations,
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'migrations' }),
  logger: undefined,
})

// `npm run db:migrate` aplica las pendientes; con `down` deshace la última.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const applied = process.argv[2] === 'down' ? await migrator.down() : await migrator.up()
  console.log(applied.length ? applied.map((m) => m.name).join('\n') : 'Nada pendiente')
  await sequelize.close()
}
