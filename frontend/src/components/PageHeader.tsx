import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '../lib/i18n'

/** Top of the secondary pages (settings, audit): the brand mark that goes back, a kicker, the title, and a right slot. */
export default function PageHeader({ onBack, kicker, title, subtitle, right }: { onBack: () => void; kicker: string; title: string; subtitle?: string; right?: ReactNode }) {
  const T = useT()
  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-3 rounded-lg transition hover:opacity-80" title={T('Volver al inicio', 'Back to the home')}>
          <img src="/icon.svg" alt="" aria-hidden className="h-9 w-9 rounded-xl shadow-sm" draggable={false} />
          <span className="serif text-xl">Tably <em className="text-accent">Team</em></span>
        </button>
        <button type="button" onClick={onBack} className="ml-2 flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm text-ink-2 shadow-sm transition hover:-translate-y-0.5 hover:border-accent hover:text-accent"><ArrowLeft size={15} /> {T('Volver', 'Back')}</button>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="mt-8">
        <div className="text-xs uppercase tracking-[0.4em] text-accent">{kicker}</div>
        <h1 className="mt-1 text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
    </div>
  )
}
