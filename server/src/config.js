import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable ${name} en server/.env`)
  return value
}

const isTest = process.env.NODE_ENV === 'test'

export const config = {
  isTest,
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required(isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL'),
  // Supabase sólo acepta conexiones cifradas; el PostgreSQL local no las necesita
  databaseSsl: process.env.DATABASE_SSL === 'true',
  sessionSecret: required('SESSION_SECRET'),
}
