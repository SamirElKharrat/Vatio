/**
 * Los consumos fijos con el nombre, los vatios y el color de su aparato tal como están ahora.
 * Así, al cambiar los vatios de un aparato, su consumo fijo se recalcula al momento.
 * Un fijo cuyo aparato ya no está (se acaba de borrar) se descarta.
 */
export function fixedLoadsWithDevices(fixedLoads, devices) {
  const byId = new Map(devices.map((device) => [device.id, device]))
  return fixedLoads.flatMap((load) => {
    const device = byId.get(load.deviceId)
    return device ? [{ ...load, name: device.name, watts: device.watts, color: device.color }] : []
  })
}

/** Los aparatos que se apuntan a mano o con rutinas: todos menos los que cuentan como consumo fijo */
export function loggableDevices(home) {
  const fixed = new Set(home.fixedLoads.map((load) => load.deviceId))
  return home.devices.filter((device) => !fixed.has(device.id))
}
