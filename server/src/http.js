import { z } from 'zod'

// Los mensajes de validación que no se escriben a mano salen también en español
z.config(z.locales.es())

/** Error con el código HTTP y el mensaje que verá quien llama a la API */
export class HttpError extends Error {
  status
  issues
  /** Clave del motivo, para que el cliente reaccione sin leer el mensaje */
  code

  constructor(status, message, issues, code) {
    super(message)
    this.status = status
    this.issues = issues
    this.code = code
  }
}

/** Valida datos de entrada; si no cuadran responde 400 con el detalle de cada campo */
export function parse(schema, data) {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  const issues = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
  throw new HttpError(400, 'Datos no válidos', issues)
}

/** Identificador de la ruta; si no es un UUID, el recurso no existe */
export function idParam(value) {
  const result = z.uuid().safeParse(value)
  if (!result.success) throw new HttpError(404, 'No encontrado')
  return result.data
}

export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, issues: err.issues, code: err.code })
    return
  }
  // multer avisa así de un archivo que pasa del tamaño permitido
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'El archivo pesa demasiado. El máximo son 10 MB.' })
    return
  }
  // Cualquier otro tropiezo de multer es culpa de cómo llega el formulario, no del servidor
  if (err?.name === 'MulterError') {
    res.status(400).json({ error: 'No se ha podido recibir el archivo. Vuelve a elegirlo.' })
    return
  }
  // express.json() rechaza el cuerpo mal formado con un error que trae su propio código
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' })
    return
  }
  // Sólo el error y dónde ha saltado; nunca la petición, que puede traer un DNI o una contraseña
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err))
  res.status(500).json({ error: 'Error interno del servidor' })
}

// Piezas de validación compartidas
export const quarter = (n) => Number.isInteger(Math.round(n * 4 * 1e6) / 1e6)

export const dateSchema = z.iso.date()
// Color de un aparato o consumo fijo, en hexadecimal (#rrggbb)
export const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, 'El color debe ir como #rrggbb').transform((c) => c.toLowerCase())
/** Contraseña nueva de una cuenta, la ponga el administrador o su dueño */
export const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200)
/** Nombre con el que se muestra una cuenta; puede quedar vacío */
export const nameSchema = z.string().trim().max(80, 'El nombre no puede pasar de 80 caracteres')
/** Correo de una cuenta: sin espacios alrededor y en minúsculas, como se guarda */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido'))

export const wattsSchema = z.number().int().min(1).max(100000)

/** Inicio y duración de un uso: en cuartos de hora y sin pasar de medianoche */
export const rangeShape = {
  start: z.number().min(0).max(23.75).refine(quarter, 'La hora debe ir en cuartos de hora'),
  hours: z.number().min(0.25).max(24).refine(quarter, 'La duración debe ir en cuartos de hora'),
}

export const withinDay = (value) =>
  value.start === undefined || value.hours === undefined || value.start + value.hours <= 24
export const withinDayMessage = { message: 'El uso no puede pasar de las 24:00', path: ['hours'] }
