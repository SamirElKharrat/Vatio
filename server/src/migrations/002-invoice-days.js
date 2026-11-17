// Días que la comercializadora dice facturar. No siempre coinciden con contar del inicio al fin del periodo.
export async function up({ context: db }) {
  await db.sequelize.query('ALTER TABLE invoices ADD COLUMN days integer CHECK (days > 0)')
}

export async function down({ context: db }) {
  await db.sequelize.query('ALTER TABLE invoices DROP COLUMN days')
}
