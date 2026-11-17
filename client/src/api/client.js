/** Respuesta de error de la API, con el mensaje que manda el servidor */
export class ApiError extends Error {
  status
  issues
  /** Clave del motivo, cuando el servidor la da (por ejemplo `password_needed`) */
  code

  constructor(status, message, issues = [], code = null) {
    super(message)
    this.status = status
    this.issues = issues
    this.code = code
  }
}

const NETWORK_MESSAGE = 'No se puede conectar con el servidor'

/** Llama a la API. La cookie de sesión viaja sola porque cliente y servidor comparten origen. */
export async function api(path, options = {}) {
  let res
  try {
    res = await fetch('/api' + path, {
      method: options.method ?? (options.form ? 'POST' : 'GET'),
      // Con un formulario el navegador pone él solo la cabecera, con su separador
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    })
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE)
  }

  if (res.status === 204) return undefined
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // Sin cuerpo JSON suele ser el proxy de desarrollo avisando de que el servidor está caído
    throw new ApiError(res.status, data?.error ?? NETWORK_MESSAGE, data?.issues, data?.code ?? null)
  }
  return data
}

/** Mensaje para enseñar a la persona: el del primer campo que falla o el general */
export function errorMessage(error) {
  if (error instanceof ApiError) return error.issues[0]?.message ?? error.message
  return 'Algo ha fallado. Inténtalo de nuevo.'
}
