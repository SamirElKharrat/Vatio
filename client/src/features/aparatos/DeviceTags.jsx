import { Link } from 'react-router'
import { routineStatus } from '../../domain/routines'
import { formatHM } from '../../domain/time'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const TAG = 'flex-none rounded-[5px] px-1.5 py-[3px] font-mono text-[10.5px] leading-none whitespace-nowrap'
// Cuántas rutinas se ven con su franja; el resto se resume en «+N»
const SHOWN = 2

/** «L M X J V» o «todos los días» */
function weekdaysLabel(weekdays) {
  if (weekdays.length === 7) return 'todos los días'
  return [...weekdays].sort((a, b) => a - b).map((day) => DAY_LETTERS[day]).join(' ')
}

/** «⟳ 14:00–15:30 · L M X J V», con «· pausada» si lo está */
function routineLabel(routine, today) {
  const paused = routineStatus(routine, today) === 'paused'
  const range = `${formatHM(routine.start)}–${formatHM(routine.start + routine.hours)}`
  return { text: `⟳ ${range} · ${weekdaysLabel(routine.weekdays)}${paused ? ' · pausada' : ''}`, paused }
}

/**
 * Las etiquetas junto al nombre de un aparato: «Fijo · 24 h» si es consumo fijo y una por cada rutina
 * con su franja y sus días. Cada rutina lleva a su ficha en Fijos y rutinas.
 */
export function DeviceTags({ isFixed, routines, today }) {
  const labels = routines.map((routine) => ({ routine, ...routineLabel(routine, today) }))
  const hidden = labels.slice(SHOWN)
  return (
    <>
      {isFixed && (
        <span title="Cuenta como consumo fijo: se suma solo todo el día y no se apunta" className={`${TAG} bg-accent/10 text-accent-ink`}>
          Fijo · 24 h
        </span>
      )}
      {labels.slice(0, SHOWN).map(({ routine, text, paused }) => (
        <Link
          key={routine.id}
          to={`/fijos?rutina=${routine.id}`}
          title={`Rutina «${routine.name}»: ábrela en Fijos y rutinas`}
          className={`${TAG} hover:underline ${paused ? 'bg-ink/7 text-ink-3' : 'bg-[#e6ecf7] text-[#2f4f86]'}`}
        >
          {text}
        </Link>
      ))}
      {hidden.length > 0 && (
        <span title={hidden.map(({ routine, text }) => `${routine.name}: ${text}`).join('\n')} className={`${TAG} bg-ink/7 text-ink-2`}>
          +{hidden.length}
        </span>
      )}
    </>
  )
}
