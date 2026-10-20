import { useSyncExternalStore } from 'react'

/**
 * UI language: Spanish (default) or English. Components call `const T = useT()` and write `T('texto', 'text')`:
 * every visible string carries both versions right where it is used. Persisted per browser; the header switch flips it.
 */
export type Lang = 'es' | 'en'
const KEY = 'arena.lang'
let lang: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'es') return v
    return 'es'  // Spanish unless the person picked English in the header (never inferred from the browser)
  } catch {
    return 'es'
  }
})()
const subs = new Set<() => void>()
try { document.documentElement.lang = lang } catch { /* ssr */ }

export function getLang(): Lang {
  return lang
}
export function setLang(l: Lang) {
  lang = l
  try {
    localStorage.setItem(KEY, l)
  } catch { /* private mode */ }
  document.documentElement.lang = l
  subs.forEach((f) => f())
}
export function useLang(): Lang {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => lang, () => lang)
}
/** `T(es, en)` → the string for the current language. */
export function useT() {
  const l = useLang()
  return (es: string, en: string) => (l === 'en' ? en : es)
}
/** Same, outside components (toasts, helpers). */
export const tr = (es: string, en: string) => (lang === 'en' ? en : es)
/** Pick a localised field from an object that may carry `<field>_en` / `<field>_es` variants. */
export function pick<T extends Record<string, any>>(o: T, field: string): string {
  const v = lang === 'en' ? o[`${field}_en`] ?? o[field] : o[`${field}_es`] ?? o[field]
  return typeof v === 'string' ? v : ''
}
