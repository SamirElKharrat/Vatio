/** La lista con el elemento de `from` movido a `to` (índices de la lista original sin él) */
export function moveItem(list, from, to) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item)
  return next
}
