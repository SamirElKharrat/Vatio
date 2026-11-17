// Nombre con el que se muestra cada cuenta. Las que ya existen empiezan sin nombre y se ven por su correo.
export async function up({ context: db }) {
  await db.sequelize.query(
    `ALTER TABLE users ADD COLUMN name text NOT NULL DEFAULT '' CHECK (char_length(name) <= 80)`,
  )
}

export async function down({ context: db }) {
  await db.sequelize.query('ALTER TABLE users DROP COLUMN name')
}
