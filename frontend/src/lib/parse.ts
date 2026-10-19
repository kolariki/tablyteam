import { getLang } from './i18n'
/** Parses the tag protocol while it is still streaming (tags may be unclosed). */
export function partialTags(raw: string): { thinking?: string; message?: string; next?: string; reason?: string; vote?: string; headline?: string; why?: string; key_moment?: string; others?: string } {
  const out: Record<string, string> = {}
  const re = /<(thinking|reflexion|message|stance|confidence|next|reason|vote|headline|why|key_moment|others)>([\s\S]*?)(?:<\/\1>|(?=<(?:thinking|reflexion|message|stance|confidence|next|reason|vote|headline|why|key_moment|others)>)|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) out[m[1].toLowerCase()] = m[2].replace(/<\/?[a-z]*$/i, '').trim()
  if (out.reflexion && !out.thinking) out.thinking = out.reflexion
  if (!out.message && !/<(thinking|reflexion|message)/i.test(raw)) out.message = raw.replace(/<[^>]*>?/g, '').trim()
  return out
}

export const STANCE: Record<string, { label: string; color: string; emoji: string }> = {
  agree: { label: 'De acuerdo', color: '#3B7F55', emoji: '🤝' },
  disagree: { label: 'En desacuerdo', color: '#B0473B', emoji: '⚔️' },
  propose: { label: 'Propone', color: '#9C7622', emoji: '💡' },
  neutral: { label: 'Neutral', color: '#7C8681', emoji: '😐' },
}

export const fmtMs = (ms?: number | null) => (ms == null ? '—' : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`)
/** Money as "USD 28,61" (es) / "USD 28.61" (en): the currency up front and a locale decimal separator, so 28.661 never
 *  reads as twenty-eight thousand. Cents for amounts from 1 up; tiny per-turn costs keep more decimals. */
export const fmtUsd = (v: number) => {
  const locale = getLang() === 'en' ? 'en-US' : 'es-AR'
  const digits = v === 0 ? 0 : v < 0.01 ? 4 : v < 1 ? 3 : 2
  return `USD ${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)}`
}
export const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)
