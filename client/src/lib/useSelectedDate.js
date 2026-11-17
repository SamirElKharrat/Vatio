import { useParams } from 'react-router'
import { isDateISO, todayISO } from './dates'

const SPANS = ['dia', 'semana', 'mes']

/** Fecha y vista de Consumo que marca la dirección; fuera de Consumo, hoy y Día */
export function useSelectedDate() {
  const params = useParams()
  return {
    date: isDateISO(params.date) ? params.date : todayISO(),
    span: SPANS.includes(params.span) ? (params.span) : 'dia',
  }
}

export const consumoPath = (span, date) => `/consumo/${span}/${date}`
