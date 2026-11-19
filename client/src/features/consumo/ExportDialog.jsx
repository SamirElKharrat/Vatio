import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../api/client'
import { useHousehold } from '../../api/hooks'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice, Loading } from '../../components/ui/Notice'
import { consumptionRows, exportFileName, exportRangeProblem, lastExportDay, MAX_EXPORT_MONTHS, toCsv } from '../../domain/csv'
import { monthRange, todayISO } from '../../lib/dates'

/** Entrega un texto como archivo descargado */
function saveFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Carga los datos del periodo y, en cuanto están, genera el CSV y lo descarga */
function Download({ from, to, onDone }) {
  const { home, error, refetch } = useHousehold(from, to)
  // Una sola descarga aunque se vuelva a pintar mientras se cierra
  const saved = useRef(false)
  useEffect(() => {
    if (!home || saved.current) return
    saved.current = true
    saveFile(exportFileName(from, to), toCsv(consumptionRows(home, from, to)))
    onDone()
  }, [home, from, to, onDone])

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
  return <Loading>Preparando el archivo…</Loading>
}

/** Descargar en CSV el consumo de un periodo elegido, de como mucho tres meses */
export function ExportDialog({ onClose }) {
  const today = todayISO()
  const month = monthRange(today)
  const [from, setFrom] = useState(month.from)
  const [to, setTo] = useState(today)
  const [downloading, setDownloading] = useState(null)
  const [done, setDone] = useState(false)
  const problem = exportRangeProblem(from, to, today)
  const maxTo = from ? [lastExportDay(from), today].sort()[0] : today

  const edit = (setter) => (event) => {
    setter(event.target.value)
    setDone(false)
  }

  return (
    <Modal open onClose={onClose} title="Descargar el consumo en CSV" width={460}>
      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
        Una fila por cada uso (apuntado a mano o de una rutina) y por cada consumo fijo y día, con los kWh por tramo y el
        coste estimado. Se abre con Excel o Google Sheets. Como mucho {MAX_EXPORT_MONTHS} meses cada vez.
      </p>

      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!problem) setDownloading({ from, to })
        }}
      >
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <Field label="Desde" type="date" max={today} value={from} onChange={edit(setFrom)} />
          <Field label="Hasta" type="date" min={from} max={maxTo} value={to} onChange={edit(setTo)} />
        </div>
        {problem && <ErrorNotice>{problem}</ErrorNotice>}
        {downloading && (
          <Download
            from={downloading.from}
            to={downloading.to}
            onDone={() => {
              setDownloading(null)
              setDone(true)
            }}
          />
        )}
        {done && (
          <p role="status" className="rounded-chip bg-valle px-3.5 py-3 text-[13px] leading-snug text-ink-2">
            Descargado. Búscalo en tu carpeta de descargas.
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <Button type="submit" variant="primary" className="flex-1" disabled={!!problem || !!downloading}>
            Descargar CSV
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
