import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Gavel, Loader2, Minus, Plus, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBuild, type TeamMember } from '../buildStore'
import { api } from '../lib/api'
import { brandTheme } from '../lib/brand'
import { tr, useT } from '../lib/i18n'
import CouncilTeamEditor from './CouncilTeamEditor'
import ReferencesField from './ReferencesField'
import ProviderLogo from './ProviderLogo'
import SkillPicker from './SkillPicker'
import { toast } from './Toast'

/** Before sending the project to the council: what the user wants treated first, who sits at the table, skills per role. */
export default function CouncilLaunch({ team, onLaunch, onClose, defaultRounds = 3, startEditing = false }: { team: TeamMember[]; onLaunch: (priorities: string, rounds: number, references: string[], deep: boolean, focus: 'production' | 'design') => Promise<void>; onClose: () => void; defaultRounds?: number; startEditing?: boolean }) {
  const T = useT()
  const [editing, setEditing] = useState(startEditing)
  const [priorities, setPriorities] = useState('')
  const [rounds, setRounds] = useState(defaultRounds)
  const [refs, setRefs] = useState<string[]>([])
  const [deep, setDeep] = useState(false)
  const [focus, setFocus] = useState<'production' | 'design'>('production')
  const [focusTouched, setFocusTouched] = useState(false)
  // references on the table: the round defaults to design (that is what references are for) unless the user chose
  useEffect(() => { if (!focusTouched) setFocus(refs.length ? 'design' : 'production') }, [refs.length, focusTouched])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const go = async () => {
    setBusy(true)
    try {
      await onLaunch(priorities.trim(), rounds, refs, deep, focus)
    } finally {
      setBusy(false)
    }
  }
  const label = 'text-[10.5px] uppercase tracking-[0.25em] text-ink-3'

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 18, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(30,38,34,.6)]" style={{ maxHeight: 'calc(100vh - 32px)' }} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-start gap-4 border-b border-line px-7 py-6">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.3em] text-accent">{T('Consejo de revisión', 'Review council')}</div>
            <h3 className="mt-0.5 text-[30px] leading-tight">{T('¿Qué querés que el equipo trate primero?', 'What should the team tackle first?')}</h3>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">{T('El consejo revisa el proyecto en la arena, en vivo. Empieza por lo que escribas acá y después suma lo que cada rol encuentre desde su área. Al final te entrega la lista de cambios.', 'The council reviews the project live in the arena. It starts with what you write here and then adds whatever each role finds from its own area. At the end it hands you the change list.')}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-3 transition hover:bg-surface-2 hover:text-ink" aria-label={T('Cerrar', 'Close')}><X size={18} strokeWidth={2.5} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-4 sm:px-7 py-5">
          {/* what kind of round */}
          <div className={label}>{T('Enfoque de la ronda', 'Round focus')}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {([
              { id: 'design', title: T('Diseño y fidelidad al referente', 'Design and fidelity to the reference'), text: T('Solo UI/UX: layout, componentes, paleta, tipografía, estados, interacciones. Nada de tests, CI ni legales.', 'UI/UX only: layout, components, palette, typography, states, interactions. No tests, CI or legal.') },
              { id: 'production', title: T('Listo para producción', 'Ready for production'), text: T('Qué falta para salir: correctitud, tests, CI, deploy, legales, rendimiento y seguridad.', 'What is missing to ship: correctness, tests, CI, deploy, legal, performance and security.') },
            ] as const).map((o) => (
              <button key={o.id} type="button" onClick={() => { setFocus(o.id); setFocusTouched(true) }} className={`rounded-xl border px-3.5 py-3 text-left transition ${focus === o.id ? 'border-accent bg-accent-soft shadow-[0_0_0_3px_rgba(47,107,93,.12)]' : 'border-line bg-paper hover:border-ink-4'}`}>
                <span className="block text-[13.5px] font-semibold">{o.title}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">{o.text}</span>
              </button>
            ))}
          </div>

          {/* priorities */}
          <div className={`${label} mt-5`}>{T('Prioridades (opcional)', 'Priorities (optional)')}</div>
          <textarea
            autoFocus={!startEditing}
            value={priorities}
            onChange={(e) => setPriorities(e.target.value)}
            rows={4}
            placeholder={T('Ej.: "Revisen el flujo de pago de punta a punta", "la pantalla principal se ve pobre en mobile", "¿el modelo de datos aguanta multi-sucursal?"', 'E.g.: "Review the payment flow end to end", "the main screen looks poor on mobile", "does the data model handle multi-branch?"')}
            className="mt-1.5 w-full resize-none rounded-2xl border border-line bg-paper px-4 py-3 text-[13.5px] shadow-sm outline-none transition focus:border-accent"
          />
          <div className="mt-1 text-[11.5px] text-ink-4">{T('Si no escribís nada, el equipo decide qué revisar.', 'If you write nothing, the team decides what to review.')}</div>

          {/* references the council should look at (researched before the round) */}
          <div className="mt-5"><ReferencesField value={refs} onChange={setRefs} deep={deep} onDeep={setDeep} compact /></div>
          {refs.length > 0 && <div className="mt-1 text-[11.5px] text-ink-3">{T('Antes de abrir el consejo, el equipo investiga estas referencias y las usa como vara en la revisión.', 'Before the council opens, the team researches these references and uses them as the bar in the review.')}</div>}

          {/* who sits at the table */}
          <div className="mt-5 rounded-2xl border border-line bg-paper shadow-[0_12px_28px_-18px_rgba(30,38,34,.35)]">
            <button type="button" onClick={() => setEditing((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><Users size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">{T('Modificar el consejo', 'Edit the council')}</span>
                <span className="block truncate text-[12px] text-ink-3">{team.length} {T('roles', 'roles')} · {[...new Set(team.map((t) => t.model))].join(' · ')}</span>
              </span>
              <span className="flex -space-x-2">
                {team.slice(0, 6).map((t) => (
                  <span key={t.id} className="flex h-7 w-7 items-center justify-center rounded-full border bg-surface shadow-sm" style={{ borderColor: brandTheme(t.provider).accent }} title={`${t.name} · ${t.role_label}`}><ProviderLogo provider={t.provider} size={15} /></span>
                ))}
              </span>
              <ChevronDown size={16} className={`shrink-0 text-ink-3 transition ${editing ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {editing && (
                <motion.div key="editor" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="overflow-hidden">
                  <div className="border-t border-line px-4 pb-4 pt-3"><CouncilTeamEditor /></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* skills per role */}
          <div className={`${label} mt-5`}>{T('Skills por rol para esta ronda (opcional)', 'Skills per role for this round (optional)')}</div>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {team.map((t) => {
              const theme = brandTheme(t.provider)
              return (
                <div key={t.id} className="flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] shadow-[0_8px_20px_-16px_rgba(30,38,34,.45)]" style={{ background: theme.bg, borderColor: theme.border }}>
                  <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm" style={{ border: `1.5px solid ${theme.accent}` }}><ProviderLogo provider={t.provider} size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.name} <span className="font-normal text-ink-3">· {t.role_label}</span></span>
                    <span className="mt-0.5 flex items-center gap-1 truncate font-mono text-[10.5px] text-ink-2" title={`${t.provider} · ${t.model}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: theme.accent }} /> {t.model}</span>
                  </span>
                  </div>
                  <div className="min-w-0"><SkillPicker value={t.skills ?? []} onChange={async (ids) => {
                    const b = useBuild.getState()
                    if (!b.id) return
                    try {
                      await api.setTeamSkills(b.id, b.sessionId, t.id, ids)
                      b.set({ team: b.team.map((x) => (x.id === t.id ? { ...x, skills: ids } : x)) })
                    } catch (e) {
                      toast.error(tr('No se pudieron cargar las skills', 'Could not load the skills'), (e as Error).message)
                    }
                  }} /></div>
                </div>
              )
            })}
          </div>
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-paper px-7 py-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-ink-3">{T('Rondas máx.', 'Max rounds')}</span>
            <button type="button" onClick={() => setRounds((r) => Math.max(1, r - 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface shadow-sm transition hover:border-accent hover:text-accent"><Minus size={13} /></button>
            <span className="w-6 text-center font-mono text-[15px]">{rounds}</span>
            <button type="button" onClick={() => setRounds((r) => Math.min(6, r + 1))} className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface shadow-sm transition hover:border-accent hover:text-accent"><Plus size={13} /></button>
          </div>
          <span className="text-[11.5px] text-ink-4">{T('Cada ronda, los roles vuelven a opinar sobre lo que cambió.', 'Each round, the roles weigh in again on what changed.')}</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className="flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent">{T('Cancelar', 'Cancel')}</button>
            <button disabled={busy || team.length < 2} onClick={go} className="flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(47,107,93,.7)] transition hover:brightness-110 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Gavel size={15} />} {T('Enviar al consejo', 'Send to the council')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
