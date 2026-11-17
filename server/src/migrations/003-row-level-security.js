// Supabase publica las tablas de `public` en su API REST. La app no la usa, pero con RLS activado
// y sin políticas esa API no deja ver ni tocar nada. La app entra como dueña de las tablas,
// así que a ella no le afecta, ni aquí ni en un PostgreSQL normal.
const TABLES = [
  'users',
  'devices',
  'usages',
  'fixed_loads',
  'routines',
  'routine_skips',
  'contracts',
  'invoices',
  'invoice_lines',
  'session',
  'migrations',
]

export async function up({ context: db }) {
  for (const table of TABLES) await db.sequelize.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
}

export async function down({ context: db }) {
  for (const table of TABLES) await db.sequelize.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`)
}
