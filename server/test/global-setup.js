// Deja la base de datos de pruebas vacía y con el esquema al día antes de los tests.
export default async function setup() {
  process.env.NODE_ENV = 'test'
  const { config } = await import('../src/config.js')

  // Se va a borrar todo el esquema: sólo si de verdad es la base de pruebas
  if (new URL(config.databaseUrl).pathname !== '/vatios_test') {
    throw new Error('DATABASE_URL_TEST debe apuntar a la base vatios_test')
  }

  const { sequelize } = await import('../src/db.js')
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  const { migrator } = await import('../src/migrate.js')
  await migrator.up()
  await sequelize.close()
}
