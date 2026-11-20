type Listener = (items: ToastItem[]) => void
export interface ToastItem { id: number; text: string; kind: 'ok' | 'error' | 'warn' }

let items: ToastItem[] = []
const listeners = new Set<Listener>()
let seq = 0

function emit() { listeners.forEach((l) => l([...items])) }

export function toast(text: string, kind: ToastItem['kind'] = 'ok') {
  const id = ++seq
  items = [...items, { id, text, kind }]
  emit()
  setTimeout(() => { items = items.filter((i) => i.id !== id); emit() }, 3200)
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  listener([...items])
  return () => { listeners.delete(listener) }
}
