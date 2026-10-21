import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useBuild } from '../buildStore'
import { useT } from '../lib/i18n'

/**
 * Why an action is unavailable right now, said on screen (not in a toast that vanishes): who is holding the service
 * (the builder, a deploy, a running app…), what it is doing, and what the user can do meanwhile.
 */
export default function BlockedNotice({ kind = 'busy', title, text, action, className = '' }: { kind?: 'busy' | 'blocked' | 'info'; title: string; text?: ReactNode; action?: { label: string; onClick: () => void }; className?: string }) {
  const tone = kind === 'blocked' ? 'border-gold/40 bg-gold/10 text-ink' : kind === 'info' ? 'border-line bg-paper text-ink' : 'border-accent/30 bg-accent-soft/60 text-ink'
  const Icon = kind === 'blocked' ? AlertTriangle : kind === 'info' ? Info : Loader2
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${tone} ${className}`} role="status">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${kind === 'blocked' ? 'bg-gold/20 text-gold' : kind === 'info' ? 'bg-surface-2 text-ink-3' : 'bg-accent text-white'}`}>
        <Icon size={14} className={kind === 'busy' ? 'animate-spin' : ''} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-snug">{title}</div>
        {text && <div className="mt-0.5 text-[12px] leading-snug text-ink-2">{text}</div>}
      </div>
      {action && <button onClick={action.onClick} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-ink-2 transition hover:border-accent hover:bg-accent-soft hover:text-accent">{action.label}</button>}
    </div>
  )
}

/** The builder holds the project (writing files): the notice every pane shows while it is busy. */
export function BuilderBusyNotice({ what, className = '' }: { what: string; className?: string }) {
  const T = useT()
  const b = useBuild()
  const busy = b.status === 'running' || b.status === 'reviewing' || b.status === 'connecting'
  if (!busy) return null
  const phase = b.status === 'reviewing' ? T('el consejo está revisando', 'the council is reviewing') : b.livePhase === 'design' ? T('está rediseñando', 'is redesigning') : b.livePhase === 'research' ? T('está investigando referencias', 'is researching references') : T('está escribiendo archivos', 'is writing files')
  return (
    <BlockedNotice
      className={className}
      title={`${T('El constructor', 'The builder')} ${phase}${b.liveTurn ? ` · ${T('turno', 'turn')} ${b.liveTurn}` : ''}`}
      text={`${what} ${T('Podés seguir el avance en el chat; esto se habilita al terminar.', 'Follow the progress in the chat; this becomes available when it finishes.')}`}
      action={{ label: T('Ver el avance', 'See the progress'), onClick: () => useBuild.getState().set({ pane: 'code', paneOpen: false }) }}
    />
  )
}
