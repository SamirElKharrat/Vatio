// Nombre de la casa de cada cuenta, el que sale bajo el nombre de la app. Las que ya existen se llaman «Casa».
export async function up({ context: db }) {
  await db.sequelize.query(
    `ALTER TABLE users ADD COLUMN household_name text NOT NULL DEFAULT 'Casa'
       CHECK (char_length(household_name) BETWEEN 1 AND 80)`,
  )
}

export async function down({ context: db }) {
  await db.sequelize.query('ALTER TABLE users DROP COLUMN household_name')
}
