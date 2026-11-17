import { errorMessage } from '../../api/client'
import { useHousehold } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { ErrorNotice, Loading } from '../../components/ui/Notice'
import { addDays, startOfWeek } from '../../domain/time'
import { monthRange } from '../../lib/dates'
import { useSelectedDate } from '../../lib/useSelectedDate'
import { DayView } from './DayView'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'

/** Pestaña Consumo: el día, la semana o el mes de la fecha que marca la dirección */
export function ConsumoPage() {
  const { date, span } = useSelectedDate()
  const monday = startOfWeek(date)
  const range = span === 'mes' ? monthRange(date) : { from: monday, to: addDays(monday, 6) }
  const { home, error, refetch } = useHousehold(range.from, range.to)

  if (error) {
    return (
      <ErrorNotice
        action={
          <Button size="sm" onClick={refetch}>
            Reintentar
          </Button>
        }
      >
        {errorMessage(error)}
      </ErrorNotice>
    )
  }
  if (!home) return <Loading />

  if (span === 'semana') return <WeekView home={home} date={date} />
  if (span === 'mes') return <MonthView home={home} date={date} />
  // Con `key`, al cambiar de día se cierran los diálogos que hubiera abiertos
  return <DayView key={date} home={home} date={date} />
}
