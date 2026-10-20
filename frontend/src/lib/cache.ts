/**
 * Remembered server answers (providers, experiments, projects…): the page opens with what it had last time and only
 * repaints when the fresh answer differs. Memory first, then localStorage so a reload is instant too. Scoped by the
 * token's user so two accounts on one browser never see each other's data; cleared on logout.
 */
import { auth } from './api'

const mem = new Map<string, { v: unknown; raw: string }>()
const PREFIX = 'arena.cache.'

const scope = () => {
  const t = auth.token
  if (!t) return 'anon'
  let h = 0
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
const key = (name: string) => `${PREFIX}${scope()}.${name}`

export function readCache<T>(name: string): T | null {
  const k = key(name)
  const m = mem.get(k)
  if (m) return m.v as T
  try {
    const raw = localStorage.getItem(k)
    if (!raw) return null
    const v = JSON.parse(raw) as T
    mem.set(k, { v, raw })
    return v
  } catch {
    return null
  }
}

/** Stores the value; returns true when it differs from what was remembered (so the caller can skip a re-render). */
export function writeCache<T>(name: string, value: T): boolean {
  const k = key(name)
  const raw = JSON.stringify(value)
  if (mem.get(k)?.raw === raw) return false
  mem.set(k, { v: value, raw })
  try {
    localStorage.setItem(k, raw)
  } catch {
    /* storage full or blocked: memory still works */
  }
  return true
}

export function clearCache() {
  mem.clear()
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}
