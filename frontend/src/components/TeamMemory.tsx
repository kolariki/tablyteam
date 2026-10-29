import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { api, type RoleInsight, type TeamMemory } from '../lib/api'
import { getLang, tr, useT } from '../lib/i18n'
import { useArena } from '../store'
import AgentAvatar from './AgentAvatar'
import { toast } from './Toast'

/**
 * Team memory: after each council round the roles learn from what the user kept and dropped. The lessons arrive as insights
 * the user accepts, edits or dismisses; the accepted ones are each role's memory and go into its prompt from then on.
 */
const useMemory = create<{ data: TeamMemory | null; open: boolean; set: (p: Partial<{ data: TeamMemory | null; open: boolean }>) => void }>((set) => ({
  data: null,
  open: false,
  set: (p) => set(p),
}))

const load = () => api.teamMemory().then((data) => { useMemory.getState().set({ data }); return data }).catch(() => null)
const label = (i: RoleInsight) => (getLang() === 'en' ? i.role_label_en : i.role_label) || i.role_label
const agentOf = (i: RoleInsight) => ({ name: i.role_label, role: i.role.startsWith('custom:') ? null : i.role })

/** Polls for new insights while signed in and tells the user once when some arrive. */
export function TeamMemoryWatcher() {
  const user = useArena((s) => s.user)
  const seen = useRef<number | null>(null)
  useEffect(() => {
    if (!user) return
    const tick = async () => {
      const d = await load()
      if (!d) return
      const n = d.insights.length
      if (seen.current !== null && n > seen.current) {
        toast.info(tr(`Tu equipo aprendió ${n - seen.current} cosa${n - seen.current === 1 ? '' : 's'}`, `Your team learned ${n - seen.current} thing${n - seen.current === 1 ? '' : 's'}`),
          tr('De lo que aceptaste y descartaste del consejo. Revisalas antes de que entren en su memoria.', 'From what you kept and dropped from the council. Review them before they go into its memory.'),
          { label: tr('Revisar', 'Review'), onClick: () => useMemory.getState().set({ open: true }) })
      }
      seen.current = n
    }
    tick()
    const t = setInterval(tick, 30000)
    const onFocus = () => tick()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [user])
  return <TeamMemoryModal />
}

/** Header pill: opens the memory, with the count of insights waiting for review. */
export function TeamMemoryButton({ className = '' }: { className?: string }) {
  const T = useT()
  const pending = useMemory((s) => s.data?.insights.length ?? 0)
  return (
    <button onClick={() => { useMemory.getState().set({ open: true }); load() }} title={T('Lo que tu equipo aprendió de tus decisiones', 'What your team learned from your decisions')} className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink-2 shadow-sm transition hover:bg-accent-soft hover:border-accent hover:text-accent ${className}`}>
      <Brain size={16} /> {T('Memoria del equipo', 'Team memory')}
      {pending > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{pending}</span>}
    </button>
  )
}

function TeamMemoryModal() {
  const T = useT()
  const { data, open } = useMemory()
  const [tab, setTab] = useState<'review' | 'memory'>('review')
  useEffect(() => { if (open) setTab((data?.insights.length ?? 0) > 0 ? 'review' : 'memory') }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => useMemory.getState().set({ open: false })
  const pending = data?.insights ?? []
  const memory = data?.memory ?? []
  const byRole = memory.reduce<Record<string, RoleInsight[]>>((acc, i) => ((acc[i.role] ??= []).push(i), acc), {})
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[300] flex items-center justify-center bg-paper/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <motion.div className="flex max-h-[86vh] min-h-[min(480px,86vh)] w-full max-w-[720px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_80px_-30px_rgba(30,38,34,.55)]" initial={{ y: 14, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, opacity: 0 }}>
            <div className="flex items-start gap-3 border-b border-line px-6 py-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white"><Brain size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="serif text-[22px] leading-tight">{T('Memoria del equipo', 'Team memory')}</div>
                <p className="mt-1 text-[13px] text-ink-3">{T('Cada rol aprende de lo que aceptás y descartás del consejo. Nada entra a su memoria sin tu OK; lo aceptado se suma a su prompt en cada debate y revisión.', 'Each role learns from what you keep and drop from the council. Nothing enters its memory without your OK; what you accept is added to its prompt in every debate and review.')}</p>
              </div>
              <button onClick={close} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label={T('Cerrar', 'Close')}><X size={18} /></button>
            </div>
            <div className="flex gap-1 px-6 pt-3">
              {(['review', 'memory'] as const).map((k) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${tab === k ? 'bg-accent text-white' : 'text-ink-2 hover:bg-surface-2'}`}>
                  {k === 'review' ? T('Para revisar', 'To review') : T('Memoria', 'Memory')} <span className="opacity-70">{k === 'review' ? pending.length : memory.length}</span>
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              {!data && <div className="flex items-center gap-2 py-10 text-sm text-ink-3"><Loader2 size={15} className="animate-spin" /> {T('Cargando…', 'Loading…')}</div>}
              {data && tab === 'review' && (pending.length ? (
                <div className="space-y-3">{pending.map((i) => <InsightCard key={i.id} item={i} />)}</div>
              ) : (
                <Empty text={T('No hay nada para revisar. Cuando apliques los cambios de un consejo, tu equipo saca lecciones de lo que aceptaste y descartaste.', 'Nothing to review. When you apply a council’s changes, your team draws lessons from what you kept and dropped.')} />
              ))}
              {data && tab === 'memory' && (memory.length ? (
                <div className="space-y-4">
                  {Object.entries(byRole).map(([role, items]) => (
                    <div key={role}>
                      <div className="mb-2 flex items-center gap-2"><AgentAvatar agent={agentOf(items[0])} size={28} /><span className="font-semibold">{label(items[0])}</span><span className="text-[12px] text-ink-4">{items.length} {T(items.length === 1 ? 'lección' : 'lecciones', items.length === 1 ? 'lesson' : 'lessons')}</span></div>
                      <div className="space-y-2">{items.map((i) => <MemoryRow key={i.id} item={i} />)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text={T('Todavía no aceptaste ninguna lección. Las que aceptes aparecen acá, por rol.', 'You have not accepted any lesson yet. The ones you accept show up here, by role.')} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-[13.5px] text-ink-3">{text}</div>
}

async function decide(id: string, action: 'accept' | 'dismiss' | 'edit' | 'forget', text?: string) {
  try {
    useMemory.getState().set({ data: await api.teamMemoryDecide(id, action, text) })
    return true
  } catch (e) {
    toast.error(tr('No se pudo guardar', 'Could not save'), (e as Error).message)
    return false
  }
}

function InsightCard({ item }: { item: RoleInsight }) {
  const T = useT()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)
  const [busy, setBusy] = useState(false)
  const run = async (action: 'accept' | 'dismiss') => { setBusy(true); await decide(item.id, action, action === 'accept' ? text : undefined); setBusy(false) }
  return (
    <div className="rounded-2xl border border-line bg-surface-2/40 p-4">
      <div className="flex items-center gap-2">
        <AgentAvatar agent={agentOf(item)} size={30} />
        <span className="font-semibold">{label(item)}</span>
        <span className="ml-auto text-[11px] uppercase tracking-widest text-ink-4">{T('aprendió', 'learned')}</span>
      </div>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="mt-3 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-accent" autoFocus />
      ) : (
        <p className="mt-3 text-[14.5px] leading-snug text-ink">{text}</p>
      )}
      {item.evidence && <p className="mt-1.5 text-[12.5px] text-ink-3">{T('Por qué', 'Why')}: {item.evidence}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || !text.trim()} onClick={() => run('accept')} className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {editing ? T('Guardar en su memoria', 'Save to its memory') : T('Sumar a su memoria', 'Add to its memory')}
        </button>
        {!editing && <button disabled={busy} onClick={() => setEditing(true)} className="flex h-8 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] text-ink-2 transition hover:border-accent hover:text-accent"><Pencil size={13} /> {T('Editar', 'Edit')}</button>}
        <button disabled={busy} onClick={() => run('dismiss')} className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-3 transition hover:text-danger"><X size={13} /> {T('Descartar', 'Dismiss')}</button>
      </div>
    </div>
  )
}

function MemoryRow({ item }: { item: RoleInsight }) {
  const T = useT()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.text)
  return (
    <div className="group flex items-start gap-2 rounded-xl border border-line px-3 py-2.5">
      {editing ? (
        <div className="flex-1">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13.5px] outline-none focus:border-accent" autoFocus />
          <div className="mt-1.5 flex gap-2">
            <button onClick={async () => { if (await decide(item.id, 'edit', text)) setEditing(false) }} className="rounded-full bg-accent px-3 py-1 text-[12.5px] font-semibold text-white">{T('Guardar', 'Save')}</button>
            <button onClick={() => { setText(item.text); setEditing(false) }} className="rounded-full px-3 py-1 text-[12.5px] text-ink-3 hover:text-ink">{T('Cancelar', 'Cancel')}</button>
          </div>
        </div>
      ) : (
        <p className="flex-1 text-[13.5px] leading-snug text-ink">{item.text}</p>
      )}
      {!editing && (
        <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
          <button onClick={() => setEditing(true)} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-accent" title={T('Editar', 'Edit')}><Pencil size={13} /></button>
          <button onClick={() => decide(item.id, 'forget')} className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-danger" title={T('Olvidar', 'Forget')}><Trash2 size={13} /></button>
        </div>
      )}
    </div>
  )
}
