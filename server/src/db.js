import { Sequelize } from 'sequelize'
import { config } from './config.js'

// Cifrado, pero sin comprobar el certificado: el de Supabase lo firma su propia autoridad.
// La URL no debe llevar `sslmode`, porque pg le haría caso a ella y no a esto.
export const ssl = config.databaseSsl ? { rejectUnauthorized: false } : false

export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: { underscored: true },
  dialectOptions: { ssl },
  // El pooler gratuito de Supabase admite pocas conexiones: entre esto y las sesiones, 8 como mucho
  pool: { max: 5 },
})
