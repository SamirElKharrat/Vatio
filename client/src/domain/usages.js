const EPS = 1e-9

const rangesOverlap = (aStart, aHours, bStart, bHours) =>
  aStart < bStart + bHours - EPS && bStart < aStart + aHours - EPS

/** ¿Hay ya un uso de ese aparato en esa franja? `usages` son los de un mismo día. */
export function hasOverlap(usages, deviceId, start, hours, ignoreId) {
  return usages.some(
    (usage) =>
      usage.deviceId === deviceId && usage.id !== ignoreId && rangesOverlap(start, hours, usage.start, usage.hours),
  )
}

/** Primer hueco del día, de media en media hora, donde cabe un uso nuevo del aparato; 0 si no hay ninguno. */
export function firstFreeSlot(usages, deviceId, hours) {
  for (let start = 0; start <= 24 - hours; start += 0.5) {
    if (!hasOverlap(usages, deviceId, start, hours)) return start
  }
  return 0
}
