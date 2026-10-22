import { setLang, useLang, type Lang } from '../lib/i18n'

/** The ES / EN pill used outside the app (landing, login); the same switch the app header has. */
export default function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useLang()
  return (
    <div className={`flex items-center rounded-full border border-line bg-surface p-0.5 text-[11px] font-semibold ${className}`} role="group" aria-label="Language">
      {(['es', 'en'] as Lang[]).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} className={`h-7 rounded-full px-2.5 uppercase transition ${lang === l ? 'bg-accent text-white shadow-sm' : 'text-ink-3 hover:bg-surface-2 hover:text-ink'}`}>{l}</button>
      ))}
    </div>
  )
}
